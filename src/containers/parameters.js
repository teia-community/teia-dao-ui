import React, { useContext } from 'react';
import { DAO_CONTRACT_ADDRESS, TOKEN_DECIMALS } from '../constants';
import { DaoContext } from './context';
import { TezosAddressLink } from './links';
import { Button } from './button';


export function Parameters() {
    // Get the required DAO context information
    const { userAddress, storage, balance, tokenBalance, governanceParameters, userTokenBalance, userVotes, community, connectWallet, claimTokens } = useContext(DaoContext);

    // Get the current governance parameters
    const currentGovernanceParameters = governanceParameters && governanceParameters[storage.gp_counter - 1];

    // Calculate the vote scaling depending on the vote method
    const voteScaling = currentGovernanceParameters?.vote_method.linear ? TOKEN_DECIMALS : Math.pow(TOKEN_DECIMALS, 0.5);

    return (
        <>
            <section>
                <h2>User information</h2>
                <ul className='parameters-list'>
                    <li>Address: {userAddress ? <TezosAddressLink address={userAddress} /> : <Button text='sync wallet' onClick={() => connectWallet()} />}</li>
                    <li>Teia Community: {community ? community : 'not a community representative'}</li>
                    <li>DAO token balance: {userTokenBalance ? userTokenBalance / TOKEN_DECIMALS : 0} TEIA tokens</li>
                    <li>Voted in {userVotes ? Object.keys(userVotes).length : 0} proposals.</li>
                    <li><Button text='Claim DAO tokens' onClick={claimTokens} /></li>
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
                    <li>DAO treasury balance: {balance ? balance / 1000000 : 0} ꜩ and {tokenBalance ? tokenBalance / TOKEN_DECIMALS : 0} TEIA tokens</li>
                </ul>
            </section>

            <section>
                <h2>Current governance parameters</h2>
                <ul className='parameters-list'>
                    <li>Vote method: {currentGovernanceParameters?.vote_method.linear ? 'linear weight' : 'quadratic weight'}</li>
                    <li>Required quorum: {storage?.quorum / voteScaling} weighted votes</li>
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
