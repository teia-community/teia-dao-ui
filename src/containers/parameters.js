import React, { useContext } from 'react';
import { DAO_CONTRACT_ADDRESS } from '../constants';
import { DaoContext } from './context';
import { TezosAddressLink } from './links';


export function Parameters() {
    // Get the required DAO context information
    const { userAddress, storage, balance, userTokenBalance, userVotes, community } = useContext(DaoContext);

    return (
        <>
            <section>
                <h2>User information</h2>
                <ul className='parameters-list'>
                    <li>Address: <TezosAddressLink address={userAddress} /></li>
                    <li>Teia Community: {community ? community : 'not representative'}</li>
                    <li>DAO token balance: {userTokenBalance ? userTokenBalance / 1000000 : '0'} TEIA tokens</li>
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
                    <li>DAO treasury balance: {balance ? balance / 1000000 : '0'} ꜩ</li>
                </ul>
            </section>

            <section>
                <h2>Governance parameters</h2>
                <ul className='parameters-list'>
                    <li>Vote method: {storage?.governance_parameters.vote_method.linear ? 'linear weight' : 'quadratic weight'}</li>
                    <li>Required quorum: {storage?.quorum / 1000000} weighted votes</li>
                    <li>Percentage for supermajority: {storage?.governance_parameters.supermajority}% positive votes</li>
                    <li>Representatives vote share: {storage?.governance_parameters.representatives_share}% of the quorum</li>
                    <li>Proposal voting period: {storage?.governance_parameters.vote_period} days</li>
                    <li>Proposal waiting period: {storage?.governance_parameters.wait_period} days</li>
                    <li>Number of tokens to escrow to submit a proposal: {storage?.governance_parameters.escrow_amount / 1000000} TEIA tokens</li>
                    <li>Minimum number of tokens required to vote a proposal: {storage?.governance_parameters.min_amount / 1000000} TEIA tokens</li>
                </ul>
            </section>
        </>
    );
}
