import React, { createContext } from 'react';
import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { Parser } from '@taquito/michel-codec';
import { validateAddress } from '@taquito/utils';
import { create } from 'ipfs-http-client';
import { NETWORK, DAO_CONTRACT_ADDRESS, RPC_NODE, IPFS_CLIENT } from '../constants';
import { InformationMessage, ConfirmationMessage, ErrorMessage } from './messages';
import * as utils from './utils';

// Initialize the tezos toolkit
const tezos = new TezosToolkit(RPC_NODE);

// Initialize the wallet
const wallet = new BeaconWallet({
    name: 'Teia DAO',
    preferredNetwork: NETWORK
});

// Pass the wallet to the tezos toolkit
tezos.setWalletProvider(wallet);

// Create an instance of the IPFS client
const ipfsClient = create(IPFS_CLIENT);

// Create the DAO context
export const DaoContext = createContext();

// Create the DAO context provider component
export class DaoContextProvider extends React.Component {

    constructor(props) {
        // Pass the properties to the base class
        super(props);

        // Define the component state parameters
        this.state = {
            // The user address
            userAddress: undefined,

            // The DAO governance contract storage
            storage: undefined,

            // The DAO treasury balance in mutez
            balance: undefined,

            // The DAO proposals
            proposals: undefined,

            // The user votes
            userVotes: undefined,

            // The user token balance
            userTokenBalance: undefined,

            // The user community in case they are a representative
            community: undefined,

            // The community votes
            communityVotes: undefined,

            // The DAO governance contract reference
            contract: undefined,

            // The information message
            informationMessage: undefined,

            // The confirmation message
            confirmationMessage: undefined,

            // The error message
            errorMessage: undefined,

            // Sets the information message
            setInformationMessage: (message) => this.setState({
                informationMessage: message
            }),

            // Sets the confirmation message
            setConfirmationMessage: (message) => this.setState({
                confirmationMessage: message
            }),

            // Sets the error message
            setErrorMessage: (message) => this.setState({
                errorMessage: message
            }),

            // Returns the DAO contract reference
            getContract: async () => {
                if (this.state.contract) {
                    return this.state.contract;
                }

                console.log('Accessing the DAO contract...');
                const contract = await utils.getContract(tezos, DAO_CONTRACT_ADDRESS);
                this.setState({ contract: contract });

                return contract;
            },

            // Connects the user wallet
            connectWallet: async () => {
                console.log('Connecting the user wallet...');
                await wallet.requestPermissions({ network: { type: NETWORK, rpcUrl: RPC_NODE } })
                    .catch(error => console.log('Error while requesting wallet permissions:', error));

                console.log('Accessing the user address...');
                const userAddress = await utils.getUserAddress(wallet);
                this.setState({ userAddress: userAddress });

                if (this.state.storage && userAddress) {
                    console.log('Downloading the user DAO votes...');
                    const userVotes = await utils.getUserVotes(userAddress, this.state.storage.token_votes);
                    this.setState({ userVotes: userVotes });

                    console.log('Downloading the user DAO token balance...');
                    const userTokenBalance = await utils.getTokenBalance(this.state.storage.token, 0, userAddress);
                    this.setState({ userTokenBalance: userTokenBalance });

                    console.log('Getting the user community...');
                    const community = await utils.getUserCommunity(userAddress, this.state.storage.representatives);
                    this.setState({ community: community });

                    if (community) {
                        console.log('Downloading the user commnuity DAO votes...');
                        const communityVotes = await utils.getCommunityVotes(community, this.state.storage.representatives_votes);
                        this.setState({ communityVotes: communityVotes });
                    }
                }
            },

            // Disconnects the user wallet
            disconnectWallet: async () => {
                // Clear the active account
                console.log('Disconnecting the user wallet...');
                await wallet.clearActiveAccount();

                // Reset the user address, votes and DAO token balance
                this.setState({
                    userAddress: undefined,
                    userVotes: undefined,
                    userTokenBalance: undefined,
                    community: undefined,
                    communityVotes: undefined
                });
            },

            // Waits for an operation to be confirmed
            confirmOperation: async (operation) => {
                // Return if the operation is undefined
                if (operation === undefined) return;

                // Display the information message
                this.state.setInformationMessage('Waiting for the operation to be confirmed...');

                // Wait for the operation to be confirmed
                console.log('Waiting for the operation to be confirmed...');
                await operation.confirmation(1)
                    .then(() => console.log(`Operation confirmed: https://${NETWORK}.tzkt.io/${operation.opHash}`))
                    .catch(error => console.log('Error while confirming the operation:', error));

                // Remove the information message
                this.state.setInformationMessage(undefined);
            },

            // Creates a text proposal
            createTextProposal: async (title, descriptionIpfsPath) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Check that the description IPFS path is not undefined
                if (!descriptionIpfsPath) {
                    this.state.setErrorMessage('The proposal description needs to be uploaded first to IPFS');
                    return;
                }

                // Send the create text proposal operation
                console.log('Sending the create text proposal operation...');
                const parameters = {
                    title: utils.stringToHex(title),
                    description: utils.stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: { text: [['unit']] }
                };
                const operation = await contract.methodsObject.create_proposal(parameters).send()
                    .catch(error => console.log('Error while sending the create text proposal operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the proposals and the user token balance
                const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(this.state.storage.token, 0, this.state.userAddress);
                this.setState({
                    proposals: proposals,
                    userTokenBalance: userTokenBalance
                });
            },

            // Creates a transfer mutez proposal
            createTransferMutezProposal: async (title, descriptionIpfsPath, transfers) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Loop over the transfers information
                let totalAmount = 0;

                for (const transfer of transfers) {
                    // Check that the destination address is a valid address
                    const destination = transfer.destination;

                    if (!(destination && validateAddress(destination) === 3)) {
                        this.state.setErrorMessage(`The provided address is not a valid tezos address: ${destination}`);
                        return;
                    }

                    totalAmount += transfer.amount;
                }

                // Check that the total amount is smaller thant the contract balance
                if (totalAmount > this.state.balance) {
                    this.state.setErrorMessage('The total amount of tez to transfer is larger than the current DAO treasury balance');
                    return;
                }

                // Send the create transfer mutez proposal operation
                console.log('Sending the create transfer mutez proposal operation...');
                const parameters = {
                    title: utils.stringToHex(title),
                    description: utils.stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: { transfer_mutez: transfers }
                };
                const operation = await contract.methodsObject.create_proposal(parameters).send()
                    .catch(error => console.log('Error while sending the create trasfer mutez proposal operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the proposals and the user token balance
                const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(this.state.storage.token, 0, this.state.userAddress);
                this.setState({
                    proposals: proposals,
                    userTokenBalance: userTokenBalance
                });
            },

            // Creates a transfer token proposal
            createTransferTokenProposal: async (title, descriptionIpfsPath, tokenContract, tokenId, transfers) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Check that the token contract address is a valid address
                if (!(tokenContract && validateAddress(tokenContract) === 3)) {
                    this.state.setErrorMessage(`The provided token contract address is not a valid tezos address: ${tokenContract}`);
                    return;
                }

                // Loop over the transfers information
                for (const transfer of transfers) {
                    // Check that the destination address is a valid address
                    const destination = transfer.destination;

                    if (!(destination && validateAddress(destination) === 3)) {
                        this.state.setErrorMessage(`The provided address is not a valid tezos address: ${destination}`);
                        return;
                    }
                }

                // Send the create transfer token proposal operation
                console.log('Sending the create transfer token proposal operation...');
                const parameters = {
                    title: utils.stringToHex(title),
                    description: utils.stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: {
                        transfer_token: {
                            fa2: tokenContract,
                            token_id: tokenId,
                            distribution: transfers
                        }
                    }
                };
                const operation = await contract.methodsObject.create_proposal(parameters).send()
                    .catch(error => console.log('Error while sending the create trasfer token proposal operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the proposals and the user token balance
                const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(this.state.storage.token, 0, this.state.userAddress);
                this.setState({
                    proposals: proposals,
                    userTokenBalance: userTokenBalance
                });
            },

            // Creates a lambda function proposal
            createLambdaFunctionProposal: async (title, descriptionIpfsPath, michelineCode) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Try to get the lambda function from the Micheline code
                let lambdaFunction;

                try {
                    const parser = new Parser();
                    lambdaFunction = parser.parseMichelineExpression(michelineCode);
                } catch (error) {
                    this.state.setErrorMessage('The provided lambda function Michelson code is not correct');
                    return;
                }

                // Send the create lambda function proposal operation
                console.log('Sending the create lambda function proposal operation...');
                const parameters = {
                    title: utils.stringToHex(title),
                    description: utils.stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: { lambda_function: lambdaFunction }
                };
                const operation = await contract.methodsObject.create_proposal(parameters).send()
                    .catch(error => console.log('Error while sending the create lambda function proposal operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the proposals and the user token balance
                const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(this.state.storage.token, 0, this.state.userAddress);
                this.setState({
                    proposals: proposals,
                    userTokenBalance: userTokenBalance
                });
            },

            // Votes a proposal as a token holder
            voteProposal: async (proposalId, vote, maxCheckpoints = null) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Send the token vote operation
                console.log('Sending the token vote operation...');
                const parameters = {
                    proposal_id: proposalId,
                    vote: { [vote]: [['unit']] },
                    max_checkpoints: maxCheckpoints
                };
                const operation = await contract.methodsObject.token_vote(parameters).send()
                    .catch(error => console.log('Error while sending the token vote operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the proposals and the user votes
                const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                const userVotes = await utils.getUserVotes(this.state.userAddress, this.state.storage.token_votes);
                this.setState({
                    proposals: proposals,
                    userVotes: userVotes
                });
            },

            // Votes a proposal as a community representative
            voteProposalAsRepresentative: async (proposalId, vote) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Send the representatives vote operation
                console.log('Sending the representatives vote operation...');
                const parameters = {
                    proposal_id: proposalId,
                    vote: { [vote]: [['unit']] }
                };
                const operation = await contract.methodsObject.representatives_vote(parameters).send()
                    .catch(error => console.log('Error while sending the representatives vote operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the proposals and the community votes
                const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                const communityVotes = await utils.getCommunityVotes(this.state.community, this.state.storage.representatives_votes);
                this.setState({
                    proposals: proposals,
                    communityVotes: communityVotes
                });
            },

            // Cancels a proposal
            cancelProposal: async (proposalId, returnEscrow = true) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Send the cancel proposal operation
                console.log('Sending the cancel proposal operation...');
                const operation = await contract.methods.cancel_proposal(proposalId, returnEscrow).send()
                    .catch(error => console.log('Error while sending the cancel proposal operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the proposals and the user token balance
                const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(this.state.storage.token, 0, this.state.userAddress);
                this.setState({
                    proposals: proposals,
                    userTokenBalance: userTokenBalance
                });
            },

            // Evaluates a proposal voting result
            evaluateVotingResult: async (proposalId) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Send the evaluate voting result operation
                console.log('Sending the evaluate voting result operation...');
                const operation = await contract.methods.evaluate_voting_result(proposalId).send()
                    .catch(error => console.log('Error while sending the evaluate voting result operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the storage, the proposals and the user token balance
                const storage = await utils.getContractStorage(DAO_CONTRACT_ADDRESS);
                const proposals = await utils.getBigmapKeys(storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(storage.token, 0, this.state.userAddress);
                this.setState({
                    proposals: proposals,
                    userTokenBalance: userTokenBalance
                });
            },

            // Executes a proposal
            executeProposal: async (proposalId) => {
                // Get the DAO contract reference
                const contract = await this.state.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Send the execute proposal operation
                console.log('Sending the execute proposal operation...');
                const operation = await contract.methods.execute_proposal(proposalId).send()
                    .catch(error => console.log('Error while sending the execute proposal operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the storage, the balance and the proposals
                const storage = await utils.getContractStorage(DAO_CONTRACT_ADDRESS);
                const balance = await utils.getBalance(storage.treasury);
                const proposals = await utils.getBigmapKeys(storage.proposals);
                this.setState({
                    storage: storage,
                    balance: balance,
                    proposals: proposals
                });
            },

            // Uploads a file to ipfs and returns the ipfs path
            uploadFileToIpfs: async (file, displayUploadInformation) => {
                // Check that the file is not undefined
                if (!file) {
                    this.state.setErrorMessage('A file needs to be loaded before uploading to IPFS');
                    return;
                }

                // Display the information message
                if (displayUploadInformation) this.state.setInformationMessage(`Uploading ${file.name} to ipfs...`);

                // Upload the file to IPFS
                console.log(`Uploading ${file.name} to ipfs...`);
                const added = await ipfsClient.add(file)
                    .catch(error => console.log(`Error while uploading ${file.name} to ipfs:`, error));

                // Remove the information message
                if (displayUploadInformation) this.state.setInformationMessage(undefined);

                // Return the IPFS path
                return added?.path;
            },
        };

        // Loads all the needed information at once
        this.loadInformation = async () => {
            // Initiailize the new state dictionary
            const new_state = {
                userAddress: undefined,
                storage: undefined,
                balance: undefined,
                proposals: undefined,
                userVotes: undefined,
                userTokenBalance: undefined,
                community: undefined,
                communityVotes: undefined
            }

            console.log('Accessing the user address...');
            const userAddress = await utils.getUserAddress(wallet);
            new_state.userAddress = userAddress;

            console.log('Downloading the DAO contract storage...');
            const storage = await utils.getContractStorage(DAO_CONTRACT_ADDRESS);
            new_state.storage = storage;

            if (storage) {
                console.log('Getting the DAO treasury tez balance...');
                const balance = await utils.getBalance(storage.treasury);
                new_state.balance = balance;

                console.log('Downloading the DAO proposals...');
                const proposals = await utils.getBigmapKeys(storage.proposals);
                new_state.proposals = proposals;

                if (userAddress) {
                    console.log('Downloading the user DAO votes...');
                    const userVotes = await utils.getUserVotes(userAddress, storage.token_votes);
                    new_state.userVotes = userVotes;

                    console.log('Downloading the user DAO token balance...');
                    const userTokenBalance = await utils.getTokenBalance(storage.token, 0, userAddress);
                    new_state.userTokenBalance = userTokenBalance;

                    console.log('Getting the user community...');
                    const community = await utils.getUserCommunity(userAddress, storage.representatives);
                    new_state.community = community;

                    if (community) {
                        console.log('Downloading the user community DAO votes...');
                        const communityVotes = await utils.getCommunityVotes(community, storage.representatives_votes);
                        new_state.communityVotes = communityVotes;
                    }
                }
            }

            // Update the component state
            this.setState(new_state);
        };
    }

    componentDidMount() {
        // Load all the relevant information
        this.loadInformation();
    }

    render() {
        return (
            <DaoContext.Provider value={this.state}>
                {this.state.informationMessage &&
                    <InformationMessage message={this.state.informationMessage} />
                }

                {this.state.confirmationMessage &&
                    <ConfirmationMessage message={this.state.confirmationMessage} onClick={() => this.state.setConfirmationMessage(undefined)} />
                }

                {this.state.errorMessage &&
                    <ErrorMessage message={this.state.errorMessage} onClick={() => this.state.setErrorMessage(undefined)} />
                }

                {this.props.children}
            </DaoContext.Provider>
        );
    }
}