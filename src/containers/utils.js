import axios from 'axios';
import { NETWORK } from '../constants';

// Returns the user address
export async function getUserAddress(wallet) {
    const activeAccount = await wallet.client.getActiveAccount()
        .catch(error => console.log('Error while accessing the active account:', error));

    return activeAccount?.address;
}

// Returns the contract reference
export async function getContract(tezos, contractAddress) {
    return await tezos.wallet.at(contractAddress)
        .catch(error => console.log('Error while accessing the contract:', error));
}

// Returns the contract storage
export async function getContractStorage(contractAddress, network = NETWORK) {
    const response = await axios.get(`https://api.${network}.tzkt.io/v1/contracts/${contractAddress}/storage`)
        .catch(error => console.log('Error while querying the contract storage:', error));

    return response?.data;
}

// Returns the account balance in mutez
export async function getBalance(account, network = NETWORK) {
    const response = await axios.get(`https://api.${network}.tzkt.io/v1/accounts/${account}/balance`)
        .catch(error => console.log('Error while querying the account balance:', error));

    return response?.data;
}

// Returns some bigmap keys
export async function getBigmapKeys(bigmap, extraParameters = {}, network = NETWORK) {
    const parameters = Object.assign(
        {
            limit: 10000,
            active: true,
            select: 'key,value',
        },
        extraParameters);
    const response = await axios.get(`https://api.${network}.tzkt.io/v1/bigmaps/${bigmap}/keys`, { params: parameters })
        .catch(error => console.log('Error while querying the bigmap keys:', error));

    return response?.data.reverse();
}

// Returns the account token balance
export async function getTokenBalance(token, tokenId, account, network = NETWORK) {
    const parameters = {
        'token.contract': token,
        'token.tokenId': tokenId,
        'account': account,
        select: 'balance',
    };
    const response = await axios.get(`https://api.${network}.tzkt.io/v1/tokens/balances`, { params: parameters })
        .catch(error => console.log('Error while querying the account token balance:', error));

    return response?.data[0];
}

// Returns the DAO governance parameters
export async function getGovernanceParameters(governanceParametersBigmap, network = NETWORK) {
    // Download the governance parameters bigmap
    const gpData = await getBigmapKeys(governanceParametersBigmap, {}, network);

    // Rearange the governance parameters information in a dictionary
    const governanceParameters = gpData ? {} : undefined;
    gpData?.forEach(gp => governanceParameters[gp.key] = gp.value);

    return governanceParameters;
}

// Returns the user DAO votes
export async function getUserVotes(userAddress, tokenVotesBigmap, network = NETWORK) {
    // Download the user votes from the token votes bigmap
    const extraParameters = { 'key.address': userAddress };
    const votes = await getBigmapKeys(tokenVotesBigmap, extraParameters, network);

    // Rearange the user votes information in a dictionary
    const userVotes = votes ? {} : undefined;
    votes?.forEach(vote => userVotes[vote.key.nat] = vote.value);

    return userVotes;
}

// Returns the user community
export async function getUserCommunity(userAddress, representativesAddress, network = NETWORK) {
    // Get the Community representatives contract storage
    const storage = await getContractStorage(representativesAddress, network);

    return storage?.representatives[userAddress];
}

// Returns the community DAO votes
export async function getCommunityVotes(community, representativesVotesBigmap, network = NETWORK) {
    // Download the community votes from the representatives votes bigmap
    const extraParameters = { 'key.string': community };
    const votes = await getBigmapKeys(representativesVotesBigmap, extraParameters, network);

    // Rearange the community votes information in a dictionary
    const communityVotes = votes ? {} : undefined;
    votes?.forEach(vote => communityVotes[vote.key.nat] = vote.value);

    return communityVotes;
}

// Transforms a string to hex bytes
export function stringToHex(str) {
    return Array.from(str).reduce((hex, c) => hex += c.charCodeAt(0).toString(16).padStart(2, '0'), '');
}

// Transforms some hex bytes to a string
export function hexToString(hex) {
    return hex.match(/.{1,2}/g).reduce((acc, char) => acc + String.fromCharCode(parseInt(char, 16)), '');
}
