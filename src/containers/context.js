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

            // The DAO governance contract reference
            contract: undefined,

            // The information message
            informationMessage: undefined,

            // The confirmation message
            confirmationMessage: undefined,

            // The error message
            errorMessage: undefined,

            // Connects the user wallet
            connectWallet: async () => {
                // Ask the user for permission to use the wallet
                console.log('Connecting the user wallet...');
                await wallet.requestPermissions({ network: { type: NETWORK, rpcUrl: RPC_NODE } })
                    .catch(error => console.log('Error while requesting wallet permissions:', error));

                // Get the user address
                console.log('Accessing the user address...');
                const userAddress = await utils.getUserAddress(wallet);
                this.setState({ userAddress: userAddress });

                if (this.state.storage && userAddress) {
                    console.log('Downloading the user DAO votes...');
                    const userVotes = await this.getUserVotes(userAddress, this.state.storage);
                    this.setState({ userVotes: userVotes });

                    console.log('Downloading the user DAO token balance...');
                    const userTokenBalance = await utils.getTokenBalance(this.state.storage.token, 0, userAddress);
                    this.setState({ userTokenBalance: userTokenBalance });
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
                    userTokenBalance: undefined
                });
            },

            // Votes a proposal
            voteProposal: async (proposalId, vote, maxCheckpoints = null) => {
                // Get the DAO contract reference
                const contract = await this.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Send the token vote operation
                console.log('Sending the token vote operation...');
                const parameters = {
                    proposal_id: proposalId,
                    vote: (vote === 'yes') ? { yes: [['unit']] } : ((vote === 'no') ? { no: [['unit']] } : { abstain: [['unit']] }),
                    max_checkpoints: maxCheckpoints
                };
                const operation = await contract.methodsObject.token_vote(parameters).send()
                    .catch(error => console.log('Error while sending the token vote operation:', error));

                // Wait for the confirmation
                await this.confirmOperation(operation);

                // Update the proposals and the user votes
                if (this.state.storage) {
                    const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                    this.setState({ proposals: proposals });

                    if (this.state.userAddress) {
                        const userVotes = await this.getUserVotes(this.state.userAddress, this.state.storage);
                        this.setState({ userVotes: userVotes });
                    }
                }
            },

            // Executes a proposal
            executeProposal: async (proposalId) => {
                // Get the DAO contract reference
                const contract = await this.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Send the execute proposal operation
                console.log('Sending the execute proposal operation...');
                const operation = await contract.methods.execute_proposal(proposalId).send()
                    .catch(error => console.log('Error while sending the execute proposal operation:', error));

                // Wait for the confirmation
                await this.confirmOperation(operation);

                // Update the storage, the balance and the proposals
                const storage = await utils.getContractStorage(DAO_CONTRACT_ADDRESS);
                this.setState({ storage: storage });

                if (storage) {
                    const balance = await utils.getBalance(storage.treasury);
                    this.setState({ balance: balance });
                    const proposals = await utils.getBigmapKeys(storage.proposals);
                    this.setState({ proposals: proposals });
                }
            },

            // Creates a text proposal
            createTextProposal: async (title, descriptionIpfsPath) => {
                // Get the DAO contract reference
                const contract = await this.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Check that the description IPFS path is not undefined
                if (!descriptionIpfsPath) {
                    this.setErrorMessage('The proposal description needs to be uploaded first to IPFS');
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
                await this.confirmOperation(operation);

                // Update the proposals
                if (this.state.storage) {
                    const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                    this.setState({ proposals: proposals });
                }
            },

            // Creates a transfer mutez proposal
            createTransferMutezProposal: async (title, descriptionIpfsPath, transfers) => {
                // Get the DAO contract reference
                const contract = await this.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Loop over the transfers information
                let totalAmount = 0;

                for (const transfer of transfers) {
                    // Check that the destination address is a valid address
                    const destination = transfer.destination;

                    if (!(destination && validateAddress(destination) === 3)) {
                        this.setErrorMessage(`The provided address is not a valid tezos address: ${destination}`);
                        return;
                    }

                    totalAmount += transfer.amount;
                }

                // Check that the total amount is smaller thant the contract balance
                if (totalAmount > this.state.balance) {
                    this.setErrorMessage('The total amount of tez to transfer is larger than the current DAO treasury balance');
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
                await this.confirmOperation(operation);

                // Update the proposals
                if (this.state.storage) {
                    const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                    this.setState({ proposals: proposals });
                }
            },

            // Creates a transfer token proposal
            createTransferTokenProposal: async (title, descriptionIpfsPath, tokenContract, tokenId, transfers) => {
                // Get the DAO contract reference
                const contract = await this.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Check that the token contract address is a valid address
                if (!(tokenContract && validateAddress(tokenContract) === 3)) {
                    this.setErrorMessage(`The provided token contract address is not a valid tezos address: ${tokenContract}`);
                    return;
                }

                // Loop over the transfers information
                for (const transfer of transfers) {
                    // Check that the destination address is a valid address
                    const destination = transfer.destination;

                    if (!(destination && validateAddress(destination) === 3)) {
                        this.setErrorMessage(`The provided address is not a valid tezos address: ${destination}`);
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
                await this.confirmOperation(operation);

                // Update the proposals
                if (this.state.storage) {
                    const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                    this.setState({ proposals: proposals });
                }
            },

            // Creates a lambda function proposal
            createLambdaFunctionProposal: async (title, descriptionIpfsPath, michelineCode) => {
                // Get the DAO contract reference
                const contract = await this.getContract();

                // Return if the DAO contract reference is not available
                if (!contract) return;

                // Try to get the lambda function from the Micheline code
                let lambdaFunction;

                try {
                    const parser = new Parser();
                    lambdaFunction = parser.parseMichelineExpression(michelineCode);
                } catch (error) {
                    this.setErrorMessage('The provided lambda function Michelson code is not correct');
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
                await this.confirmOperation(operation);

                // Update the proposals
                if (this.state.storage) {
                    const proposals = await utils.getBigmapKeys(this.state.storage.proposals);
                    this.setState({ proposals: proposals });
                }
            },

            // Uploads a file to ipfs and returns the ipfs path
            uploadFileToIpfs: async (file, displayUploadInformation) => {
                // Check that the file is not undefined
                if (!file) {
                    this.setErrorMessage('A file needs to be loaded before uploading to IPFS');
                    return;
                }

                // Display the information message
                if (displayUploadInformation) this.setInformationMessage(`Uploading ${file.name} to ipfs...`);

                // Upload the file to IPFS
                console.log(`Uploading ${file.name} to ipfs...`);
                const added = await ipfsClient.add(file)
                    .catch(error => console.log(`Error while uploading ${file.name} to ipfs:`, error));

                // Remove the information message
                if (displayUploadInformation) this.setInformationMessage(undefined);

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
                userTokenBalance: undefined
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
                    const userVotes = await this.getUserVotes(userAddress, storage);
                    new_state.userVotes = userVotes;

                    console.log('Downloading the user DAO token balance...');
                    const userTokenBalance = await utils.getTokenBalance(storage.token, 0, userAddress);
                    new_state.userTokenBalance = userTokenBalance;
                }
            }

            // Update the component state
            this.setState(new_state);
        };

        // Returns the user DAO votes
        this.getUserVotes = async (userAddress, storage) => {
            // Download the user votes from the token votes bigmap
            const extra_parameters = { 'key.address': userAddress };
            const votes = await utils.getBigmapKeys(storage.token_votes, extra_parameters);

            // Rearange the user votes information in a dictionary
            const userVotes = votes ? {} : undefined;
            votes?.forEach(vote => userVotes[vote.key.nat] = vote.value);

            return userVotes;
        };

        // Returns the DAO contract reference
        this.getContract = async () => {
            if (this.state.contract) {
                return this.state.contract;
            }

            console.log('Accessing the DAO contract...');
            const contract = await utils.getContract(tezos, DAO_CONTRACT_ADDRESS);
            this.setState({ contract: contract });

            return contract;
        };

        // Sets the information message
        this.setInformationMessage = (message) => this.setState({
            informationMessage: message
        });

        // Sets the error message
        this.setErrorMessage = (message) => this.setState({
            errorMessage: message
        });

        // Waits for an operation to be confirmed
        this.confirmOperation = async (operation) => {
            // Return if the operation is undefined
            if (operation === undefined) return;

            // Display the information message
            this.setInformationMessage('Waiting for the operation to be confirmed...');

            // Wait for the operation to be confirmed
            console.log('Waiting for the operation to be confirmed...');
            await operation.confirmation(1)
                .then(() => console.log(`Operation confirmed: https://${NETWORK}.tzkt.io/${operation.opHash}`))
                .catch(error => console.log('Error while confirming the operation:', error));

            // Remove the information message
            this.setInformationMessage(undefined);
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
                    <ConfirmationMessage message={this.state.confirmationMessage} onClick={() => this.setConfirmationMessage(undefined)} />
                }

                {this.state.errorMessage &&
                    <ErrorMessage message={this.state.errorMessage} onClick={() => this.setErrorMessage(undefined)} />
                }

                {this.props.children}
            </DaoContext.Provider>
        );
    }
}
