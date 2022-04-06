import React, { createContext } from 'react';
import { TezosToolkit } from '@taquito/taquito';
import { validateAddress } from '@taquito/utils';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { Parser } from '@taquito/michel-codec';
import axios from 'axios';
import { create } from 'ipfs-http-client';
import { stringToHex } from '../utils';
import { InformationMessage, ConfirmationMessage, ErrorMessage } from '../messages';


// Define the DAO contract address
const daoContractAddress = 'KT1SpmiaEkwEg9Q7wsb8G6noEpM5xcRozror';

// Set the connection parameters
const network = 'ithacanet';
//const rpcNode = `https://${network}.api.tez.ie`;
const rpcNode = 'https://ithacanet.ecadinfra.com';

// Initialize the tezos toolkit
const tezos = new TezosToolkit(rpcNode);

// Initialize the wallet
const wallet = new BeaconWallet({
    name: 'Teia DAO',
    preferredNetwork: network
});

// Pass the wallet to the tezos toolkit
tezos.setWalletProvider(wallet);

// Create an instance of the IPFS client
const ipfsClient = create('https://ipfs.infura.io:5001/api/v0');

// Create the DAO context
export const DaoContext = createContext();

// Create the DAO context provider component
export class DaoContextProvider extends React.Component {

    constructor(props) {
        // Pass the properties to the base class
        super(props);

        // Sets the current active account
        this.setActiveAccount = async (callback) => {
            // Get the current active account
            console.log('Accessing the current active account...');
            const activeAccount = await wallet.client.getActiveAccount()
                .catch((error) => console.log('Error while accessing the active account:', error));

            // Update the component state
            this.setState({
                activeAccount: activeAccount
            }, callback);
        };

        // Sets the DAO contract storage
        this.setStorage = async () => {
            // Send a query to tzkt to get the contract storage
            console.log('Querying tzKt to get the DAO contract storage...');
            const response = await axios.get(`https://api.${this.state.network}.tzkt.io/v1/contracts/${this.state.contractAddress}/storage`)
                .catch((error) => console.log('Error while querying the contract storage:', error));

            // Update the component state
            this.setState({
                storage: response?.data
            });
        };

        // Sets the DAO treasury contract balance
        this.setBalance = async () => {
             // Check if the contract storage is defined
            if (this.state.storage) {
                // Send a query to tzkt to get the DAO treasury contract balance
                console.log('Querying tzKt to get the DAO treasury contract balance...');
                const response = await axios.get(`https://api.${this.state.network}.tzkt.io/v1/accounts/${this.state.storage.treasury}/balance`)
                    .catch((error) => console.log('Error while querying the contract balance:', error));

                // Update the component state
                this.setState({
                    balance: response?.data
                });
            } else {
                // Update the component state
                this.setState({
                    balance: undefined
                });
            }
        };

        // Sets the DAO proposals
        this.setProposals = async () => {
             // Check if the contract storage is defined
            if (this.state.storage) {
                // Send a query to tzkt to get all the proposals bigmap keys
                console.log('Querying tzKt to get the DAO proposals...');
                const response = await axios.get(`https://api.${this.state.network}.tzkt.io/v1/bigmaps/${this.state.storage.proposals}/keys`, {
                        params: {
                            limit: 10000,
                            active: true,
                            select: 'key,value',
                        }
                    })
                    .catch((error) => console.log('Error while querying the proposals bigmap:', error));

                // Update the component state
                this.setState({
                    proposals: response?.data.reverse()
                });
            } else {
                // Update the component state
                this.setState({
                    proposals: undefined
                });
            }
        };

        // Sets the votes from the active account
        this.setUserVotes = async () => {
            // Check if the active account and the contract storage are defined
            if (this.state.activeAccount && this.state.storage) {
                // Send a query to tzkt to get the user votes
                console.log('Querying tzKt to get the user votes...');
                const response = await axios.get(`https://api.${this.state.network}.tzkt.io/v1/bigmaps/${this.state.storage.token_votes}/keys`, {
                    params: {
                        'key.address': this.state.activeAccount.address,
                        limit: 10000,
                        active: true,
                        select: 'key,value',
                    }
                })
                .catch((error) => console.log('Error while querying the token_votes bigmap:', error));

                // Rearange the user votes information in a dictionary
                const userVotes = response? {} : undefined;
                response?.data.forEach((vote) => {userVotes[vote.key.nat] = vote.value;});

                // Update the component state
                this.setState({
                    userVotes: userVotes
                });
            } else {
                // Update the component state
                this.setState({
                    userVotes: undefined
                });
            }
        };

        // Sets the DAO token balance from the active account
        this.setUserTokenBalance = async () => {
             // Check if the active account and the contract storage are defined
            if (this.state.activeAccount && this.state.storage) {
                // Send a query to tzkt to get the user token balance
                console.log('Querying tzKt to get the user token balance...');
                const response = await axios.get(`https://api.${this.state.network}.tzkt.io/v1/tokens/balances`, {
                    params: {
                        'token.contract': this.state.storage.token,
                        'token.tokenId': 0,
                        'account': this.state.activeAccount.address,
                        select: 'balance',
                    }
                })
                .catch((error) => console.log('Error while querying the user token balance:', error));

                // Update the component state
                this.setState({
                    userTokenBalance: (response?.data.length > 0)? parseInt(response.data[0]) : 0
                });
            } else {
                // Update the component state
                this.setState({
                    userTokenBalance: undefined
                });
            }
        };

        // Sets the DAO contract reference
        this.setContract = async () => {
            // Get the DAO contract reference
            console.log('Accessing the DAO contract...');
            const contract = await tezos.wallet.at(this.state.contractAddress)
                .catch((error) => console.log('Error while accessing the contract:', error));

            // Update the component state
            this.setState({
                contract: contract
            });
        };

        // Sets the information message
        this.setInformationMessage = (message) => this.setState({
            informationMessage: message
        });

        // Sets the error message
        this.setErrorMessage = (message) => this.setState({
            errorMessage: message
        });

        // Checks if the DAO contract reference is available
        this.contractIsAvailable = async () => {
            // Try to set the DAO contract reference if it's undefined
            if (this.state.contract === undefined) await this.setContract();

            return this.state.contract !== undefined;
        };

        // Waits for an operation to be confirmed
        this.confirmOperation = async (operation) => {
            // Return if the operation is undefined
            if (operation === undefined) return;

            // Display the information message
            this.setInformationMessage('Waiting for the operation to be confirmed...');

            // Wait for the operation to be confirmed
            console.log('Waiting for the operation to be confirmed...');
            await operation.confirmation(1)
                .then(() => console.log(`Operation confirmed: https://${this.state.network}.tzkt.io/${operation.opHash}`))
                .catch((error) => console.log('Error while confirming the operation:', error));

            // Remove the information message
            this.setInformationMessage(undefined);
        };

        // Define the component state parameters
        this.state = {
            // The tezos network
            network: network,

            // The DAO contract address
            contractAddress: daoContractAddress,

            // The current active account
            activeAccount: undefined,

            // The DAO contract storage
            storage: undefined,

            // The DAO treasury contract balance in mutez
            balance: undefined,

            // The DAO proposals
            proposals: undefined,

            // The user votes
            userVotes: undefined,

            // The user token balance
            userTokenBalance: undefined,

            // The DAO contract reference
            contract: undefined,

            // The information message
            informationMessage: undefined,

            // The confirmation message
            confirmationMessage: undefined,

            // The error message
            errorMessage: undefined,

            // Connects the user wallet if it was not connected before
            connectWallet: async () => {
                // Ask the user for the permission to use the wallet
                console.log('Connecting the user wallet...');
                await wallet.requestPermissions({network : {type: this.state.network, rpcUrl: rpcNode}})
                    .catch((error) => console.log('Error while requesting wallet permissions:', error));

                // Set the active account state
                await this.setActiveAccount(
                    async () => {
                        // Set the user votes and token balance
                           await this.setUserVotes();
                        await this.setUserTokenBalance();
                    }
                );
            },

            // Disconnects the user wallet
            disconnectWallet: async () => {
                // Clear the active account
                console.log('Disconnecting the user wallet...');
                await wallet.clearActiveAccount();

                // Reset the active account, the user votes, the user token
                // balance and the contract reference as undefined
                this.setState({
                    activeAccount: undefined,
                    userVotes: undefined,
                    userTokenBalance: undefined,
                    contract: undefined
                });
            },

            // Votes a proposal
            voteProposal: async (proposalId, vote) => {
                // Return if the DAO contract reference is not available
                if (!(await this.contractIsAvailable())) return;

                // Send the vote proposal operation
                console.log('Sending the token vote operation...');
                const parameters = {
                    proposal_id: proposalId,
                    vote: (vote === 'yes') ? {yes: [['unit']]} : ((vote === 'no') ? {no: [['unit']]} : {abstain: [['unit']]}),
                    max_checkpoints: null
                };
                const operation = await this.state.contract.methodsObject.token_vote(parameters).send()
                    .catch((error) => console.log('Error while sending the token vote operation:', error));

                // Wait for the confirmation
                await this.confirmOperation(operation);

                // Update the proposals and the user votes
                await this.setProposals();
                await this.setUserVotes();
            },

            // Executes a proposal
            executeProposal: async (proposalId) => {
                // Return if the DAO contract reference is not available
                if (!(await this.contractIsAvailable())) return;

                // Send the execute proposal operation
                console.log('Sending the execute proposal operation...');
                const operation = await this.state.contract.methods.execute_proposal(proposalId).send()
                    .catch((error) => console.log('Error while sending the execute proposal operation:', error));

                // Wait for the confirmation
                await this.confirmOperation(operation);

                // Update the storage, the balance and the proposals
                await this.setStorage();
                await this.setBalance();
                await this.setProposals();
            },

            // Creates a text proposal
            createTextProposal: async (title, descriptionIpfsPath) => {
                // Return if the DAO contract reference is not available
                if (!(await this.contractIsAvailable())) return;

                // Check that the description IPFS path is not undefined
                if (!descriptionIpfsPath) {
                    this.setErrorMessage('The proposal description needs to be uploaded first to IPFS');
                    return;
                }

                // Send the create proposal operation
                console.log('Sending the create text proposal operation...');
                const parameters = {
                    title: stringToHex(title),
                    description: stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: {text: [['unit']]}
                };
                const operation = await this.state.contract.methodsObject.create_proposal(parameters).send()
                    .catch((error) => console.log('Error while sending the create text proposal operation:', error));

                // Wait for the confirmation
                await this.confirmOperation(operation);

                // Update the proposals
                await this.setProposals();
            },

            // Creates a transfer mutez proposal
            createTransferMutezProposal: async (title, descriptionIpfsPath, transfers) => {
                // Return if the DAO contract reference is not available
                if (!(await this.contractIsAvailable())) return;

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
                    this.setErrorMessage('The total amount of tez to transfer is larger than the current contract balance');
                    return;
                }

                // Send the transfer mutez proposal operation
                console.log('Sending the create transfer mutez proposal operation...');
                const parameters = {
                    title: stringToHex(title),
                    description: stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: {transfer_mutez: transfers}
                };
                const operation = await this.state.contract.methodsObject.create_proposal(parameters).send()
                    .catch((error) => console.log('Error while sending the create trasfer mutez proposal operation:', error));

                // Wait for the confirmation
                await this.confirmOperation(operation);

                // Update the proposals
                await this.setProposals();
            },

            // Creates a transfer token proposal
            createTransferTokenProposal: async (title, descriptionIpfsPath, tokenContract, tokenId, transfers) => {
                // Return if the DAO contract reference is not available
                if (!(await this.contractIsAvailable())) return;

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

                // Send the transfer token proposal operation
                console.log('Sending the create transfer token proposal operation...');
                const parameters = {
                    title: stringToHex(title),
                    description: stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: {transfer_token: {
	                   fa2: tokenContract,
	                   token_id: tokenId,
	                   distribution: transfers
                    }}
                };
                const operation = await this.state.contract.methodsObject.create_proposal(parameters).send()
                    .catch((error) => console.log('Error while sending the create trasfer token proposal operation:', error));

                // Wait for the confirmation
                await this.confirmOperation(operation);

                // Update the proposals
                await this.setProposals();
            },

            // Creates a lambda function proposal
            createLambdaFunctionProposal: async (title, descriptionIpfsPath, michelineCode) => {
                // Return if the DAO contract reference is not available
                if (!(await this.contractIsAvailable())) return;

                // Try to get the lambda function from the Micheline code
                let lambdaFunction;

                try {
                    const parser = new Parser();
                    lambdaFunction = parser.parseMichelineExpression(michelineCode);
                } catch (error) {
                    this.setErrorMessage('The provided lambda function Michelson code is not correct');
                    return;
                }

                // Send the lambda function proposal operation
                console.log('Sending the create lambda function proposal operation...');
                const parameters = {
                    title: stringToHex(title),
                    description: stringToHex('ipfs://' + descriptionIpfsPath),
                    kind: {lambda_function: lambdaFunction}
                };
                const operation = await this.state.contract.methodsObject.create_proposal(parameters).send()
                    .catch((error) => console.log('Error while sending the create lambda function proposal operation:', error));

                // Wait for the confirmation
                await this.confirmOperation(operation);

                // Update the proposals
                await this.setProposals();
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
                    .catch((error) => console.log(`Error while uploading ${file.name} to ipfs:`, error));

                // Remove the information message
                if (displayUploadInformation) this.setInformationMessage(undefined);

                 // Return the IPFS path
                return added?.path;
            },
        };
    }

    componentDidMount() {
        // Initialize all the relevant information in the correct order
        this.setActiveAccount()
            .then(() => this.setStorage())
            .then(() => this.setBalance())
            .then(() => this.setProposals())
            .then(() => this.setUserVotes())
            .then(() => this.setUserTokenBalance())
            .then(() => this.setContract());
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
