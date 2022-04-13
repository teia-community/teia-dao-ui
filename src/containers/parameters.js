import React, { useContext } from 'react';
import { DAO_CONTRACT_ADDRESS, TOKEN_DECIMALS } from '../constants';
import { DaoContext } from './context';
import { TezosAddressLink } from './links';


export function Parameters() {
    // Get the required DAO context information
    const { userAddress, storage, balance, tokenBalance, governanceParameters, userTokenBalance, userVotes, community } = useContext(DaoContext);

    // Get the current governance parameters
    const currentGovernanceParameters = governanceParameters && governanceParameters[storage?.gp_counter - 1];
 
    return (
        <>
            <section>
                <h2>User information</h2>
                <ul className='parameters-list'>
                    <li>Address: <TezosAddressLink address={userAddress} /></li>
                    <li>Teia Community: {community ? community : 'not representative'}</li>
                    <li>DAO token balance: {userTokenBalance ? userTokenBalance / TOKEN_DECIMALS : '0'} TEIA tokens</li>
                    <li>Voted in {userVotes ? Object.keys(userVotes).length : '0'} proposals.</li>
                </ul>
            </section>

            <section>
                <h2>DAO smart contracts</h2>
                <ul className='parameters-list'>
                    <li>DAO governance: <TezosAddressLink address={DAO_CONTRACT_ADDRESS} /></li>
                    <li>DAO token: <TezosAddressLink address={storage?.token} /></li>
                    <li>DAO treasury: <TezosAddressLink address={storage?.treasury} /></li>
                    <li>DAO guardians: <TezosAddressLink address={storage?.guardians} /></li>
                    <li>DAO administrator: <TezosAddressLink address={storage?.administrator} /></li>
                    <li>Teia Community representatives: <TezosAddressLink address={storage?.representatives} /></li>
                    <li>DAO treasury balance: {balance ? balance / 1000000 : '0'} ꜩ and {tokenBalance ? tokenBalance / TOKEN_DECIMALS : '0'} TEIA tokens</li>
                </ul>
            </section>

            <section>
                <h2>Governance parameters</h2>
                <ul className='parameters-list'>
                    <li>Vote method: {currentGovernanceParameters?.vote_method.linear ? 'linear weight' : 'quadratic weight'}</li>
                    <li>Required quorum: {storage?.quorum / TOKEN_DECIMALS} weighted votes</li>
                    <li>Percentage for supermajority: {currentGovernanceParameters?.supermajority}% positive votes</li>
                    <li>Representatives vote share: {currentGovernanceParameters?.representatives_share}% of the quorum</li>
                    <li>Proposal voting period: {currentGovernanceParameters?.vote_period} days</li>
                    <li>Proposal waiting period: {currentGovernanceParameters?.wait_period} days</li>
                    <li>Number of tokens to escrow to submit a proposal: {currentGovernanceParameters?.escrow_amount / TOKEN_DECIMALS} TEIA tokens</li>
                    <li>Minimum number of tokens required to vote a proposal: {currentGovernanceParameters?.min_amount / TOKEN_DECIMALS} TEIA tokens</li>
                </ul>
            </section>
        </>
    );
}
