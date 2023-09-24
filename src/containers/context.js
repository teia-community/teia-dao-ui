import React, { createContext } from 'react';
import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { Parser } from '@taquito/michel-codec';
import { validateAddress } from '@taquito/utils';
import {
    NETWORK, DAO_CONTRACT_ADDRESS, RPC_NODE, IPFS_GATEWAY
} from '../constants';
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

            // The DAO treasury mutez balance
            balance: undefined,

            // The DAO treasury DAO token balance
            tokenBalance: undefined,

            // The DAO governance parameters
            governanceParameters: undefined,

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

            // The DAO Token contract reference
            tokenContract: undefined,

            // The DAO Token drop contract reference
            dropContract: undefined,

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

            // Returns the DAO governance contract reference
            getContract: async () => {
                if (this.state.contract) {
                    return this.state.contract;
                }

                console.log('Accessing the DAO governance contract...');
                const contract = await utils.getContract(tezos, DAO_CONTRACT_ADDRESS);
                this.setState({ contract: contract });

                return contract;
            },

            // Returns the DAO token contract reference
            getTokenContract: async () => {
                if (this.state.tokenContract) {
                    return this.state.tokenContract;
                }

                if (!this.state.storage) return undefined;

                console.log('Accessing the DAO token contract...');
                const tokenContract = await utils.getContract(tezos, this.state.storage.token);
                this.setState({ tokenContract: tokenContract });

                return tokenContract;
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

                // Reset the user related state parameters
                this.setState({
                    userAddress: undefined,
                    userVotes: undefined,
                    userTokenBalance: undefined,
                    community: undefined,
                    communityVotes: undefined,
                    contract: undefined,
                    tokenContract: undefined,
                    dropContract: undefined
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

            // Creates a DAO proposal
            createProposal: async (title, descriptionIpfsPath, kind) => {
                // Get the DAO governance and DAO token contract references
                const contract = await this.state.getContract();
                const tokenContract = await this.state.getTokenContract();

                // Return if one of the contract references is not available
                if (!contract || !tokenContract) return;

                // Check that the description IPFS path is not undefined
                if (!descriptionIpfsPath) {
                    this.state.setErrorMessage('The proposal description needs to be uploaded first to IPFS');
                    return;
                }

                // Initialize the batch operation
                let batch = tezos.wallet.batch();

                // Add the token operator
                const operator = {
                    owner: this.state.userAddress,
                    operator: DAO_CONTRACT_ADDRESS,
                    token_id: 0
                };
                batch = batch.withContractCall(
                    tokenContract.methods.update_operators([{ add_operator: operator }])
                );

                // Add the create proposal operation
                const parameters = {
                    title: utils.stringToHex(title),
                    description: utils.stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: kind
                };
                batch = batch.withContractCall(
                    contract.methodsObject.create_proposal(parameters)
                );

                // Remove the token operator
                batch = batch.withContractCall(
                    tokenContract.methods.update_operators([{ remove_operator: operator }])
                );

                // Send the batch operation
                console.log('Sending the create proposal operation...');
                const operation = await batch.send()
                    .catch(error => console.log('Error while sending the create proposal operation:', error));

                // Wait for the confirmation
                await this.state.confirmOperation(operation);

                // Update the proposals and the user token balance
                const storage = this.state.storage;
                const proposals = await utils.getBigmapKeys(storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(storage.token, 0, this.state.userAddress);
                this.setState({
                    proposals: proposals,
                    userTokenBalance: userTokenBalance
                });
            },

            // Creates a text proposal
            createTextProposal: async (title, descriptionIpfsPath) => {
                // Create the text proposal
                const kind = { text: [['unit']] };
                this.state.createProposal(title, descriptionIpfsPath, kind);
            },

            // Creates a transfer mutez proposal
            createTransferMutezProposal: async (title, descriptionIpfsPath, transfers) => {
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

                // Create the transfer mutez proposal
                const kind = { transfer_mutez: transfers };
                this.state.createProposal(title, descriptionIpfsPath, kind);
            },

            // Creates a transfer token proposal
            createTransferTokenProposal: async (title, descriptionIpfsPath, tokenAddress, tokenId, transfers) => {
                // Check that the token contract address is a valid address
                if (!(tokenAddress && validateAddress(tokenAddress) === 3)) {
                    this.state.setErrorMessage(`The provided token contract address is not a valid tezos address: ${tokenAddress}`);
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

                // Create the transfer token proposal
                const kind = {
                    transfer_token: {
                        fa2: tokenAddress,
                        token_id: tokenId,
                        distribution: transfers
                    }
                };
                this.state.createProposal(title, descriptionIpfsPath, kind);
            },

            // Creates a lambda function proposal
            createLambdaFunctionProposal: async (title, descriptionIpfsPath, michelineCode) => {
                // Try to get the lambda function from the Micheline code
                let lambdaFunction;

                try {
                    const parser = new Parser();
                    lambdaFunction = parser.parseMichelineExpression(michelineCode);
                } catch (error) {
                    this.state.setErrorMessage('The provided lambda function Michelson code is not correct');
                    return;
                }

                // Create the lambda function proposal
                const kind = { lambda_function: lambdaFunction };
                this.state.createProposal(title, descriptionIpfsPath, kind);
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
                const storage = this.state.storage;
                const proposals = await utils.getBigmapKeys(storage.proposals);
                const userVotes = await utils.getUserVotes(this.state.userAddress, storage.token_votes);
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
                const storage = this.state.storage;
                const proposals = await utils.getBigmapKeys(storage.proposals);
                const communityVotes = await utils.getCommunityVotes(this.state.community, storage.representatives_votes);
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

                // Update the treasury token balance, the proposals and the user token balance
                const storage = this.state.storage;
                const tokenBalance = await utils.getTokenBalance(storage.token, 0, storage.treasury);
                const proposals = await utils.getBigmapKeys(storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(storage.token, 0, this.state.userAddress);
                this.setState({
                    tokenBalance: tokenBalance,
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

                // Update the storage, the treasury token balance, the proposals and the user token balance
                const storage = await utils.getContractStorage(DAO_CONTRACT_ADDRESS);
                const tokenBalance = await utils.getTokenBalance(storage.token, 0, storage.treasury);
                const proposals = await utils.getBigmapKeys(storage.proposals);
                const userTokenBalance = await utils.getTokenBalance(storage.token, 0, this.state.userAddress);
                this.setState({
                    storage: storage,
                    tokenBalance: tokenBalance,
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

                // Update the storage, the treasury balance, the treasury token balance and the proposals
                const storage = await utils.getContractStorage(DAO_CONTRACT_ADDRESS);
                const balance = await utils.getBalance(storage.treasury);
                const tokenBalance = await utils.getTokenBalance(storage.token, 0, storage.treasury);
                const governanceParameters = await utils.getGovernanceParameters(storage.governance_parameters);
                const proposals = await utils.getBigmapKeys(storage.proposals);
                this.setState({
                    storage: storage,
                    balance: balance,
                    tokenBalance: tokenBalance,
                    governanceParameters: governanceParameters,
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
                const added = await utils.uploadFileToIPFSProxy(file)
                    .catch(error => console.log(`Error while uploading ${file.name} to ipfs:`, error));

                // Remove the information message
                if (displayUploadInformation) this.state.setInformationMessage(undefined);

                // Return the IPFS path
                return added?.data.cid;
            },

            // Downloads a file from ipfs
            downloadFileFromIpfs: async (ipfsPath) => {
                // Download the file from IPFS
                console.log(`Downloading file from ipfs with path ${ipfsPath}...`);
                const response = await fetch(IPFS_GATEWAY + ipfsPath);

                if (!response.ok) {
                    this.state.setErrorMessage(`There was a problem downloading a file from ipfs with path ${ipfsPath}`);
                    return;
                }

                return await response.json();
            },
        };

        // Loads all the needed information at once
        this.loadInformation = async () => {
            // Initialize the new state dictionary
            const newState = {}

            console.log('Accessing the user address...');
            const userAddress = await utils.getUserAddress(wallet);
            newState.userAddress = userAddress;

            console.log('Downloading the DAO contract storage...');
            const storage = await utils.getContractStorage(DAO_CONTRACT_ADDRESS);
            newState.storage = storage;

            if (storage) {
                console.log('Getting the DAO treasury tez balance...');
                const balance = await utils.getBalance(storage.treasury);
                newState.balance = balance;

                console.log('Downloading the DAO treasury DAO token balance...');
                const tokenBalance = await utils.getTokenBalance(storage.token, 0, storage.treasury);
                newState.tokenBalance = tokenBalance;

                console.log('Downloading the DAO governance parameters...');
                const governanceParameters = await utils.getGovernanceParameters(storage.governance_parameters);
                newState.governanceParameters = governanceParameters;

                console.log('Downloading the DAO proposals...');
                const proposals = await utils.getBigmapKeys(storage.proposals);
                newState.proposals = proposals;

                if (userAddress) {
                    console.log('Downloading the user DAO votes...');
                    const userVotes = await utils.getUserVotes(userAddress, storage.token_votes);
                    newState.userVotes = userVotes;

                    console.log('Downloading the user DAO token balance...');
                    const userTokenBalance = await utils.getTokenBalance(storage.token, 0, userAddress);
                    newState.userTokenBalance = userTokenBalance;

                    console.log('Getting the user community...');
                    const community = await utils.getUserCommunity(userAddress, storage.representatives);
                    newState.community = community;

                    if (community) {
                        console.log('Downloading the user community DAO votes...');
                        const communityVotes = await utils.getCommunityVotes(community, storage.representatives_votes);
                        newState.communityVotes = communityVotes;
                    }
                }
            }

            // Update the component state
            this.setState(newState);
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
