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
export async function getBigmapKeys(bigmap, extra_parameters = {}, network = NETWORK) {
    const parameters = Object.assign(
        {
            limit: 10000,
            active: true,
            select: 'key,value',
        },
        extra_parameters);
    const response = await axios.get(`https://api.${network}.tzkt.io/v1/bigmaps/${bigmap}/keys`, { params: parameters })
        .catch(error => console.log('Error while querying the bigmap keys:', error));

    return response?.data;
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

// Transforms a string to hex bytes
export function stringToHex(str) {
    return Array.from(str).reduce((hex, c) => hex += c.charCodeAt(0).toString(16).padStart(2, '0'), '');
}

// Transforms some hex bytes to a string
export function hexToString(hex) {
    return hex.match(/.{1,2}/g).reduce((acc, char) => acc + String.fromCharCode(parseInt(char, 16)), '');
}
