import React, { useContext } from 'react';
import { DAO_CONTRACT_ADDRESS } from '../constants';
import { DaoContext } from './context';
import { TezosAddressLink } from './links';


export function Parameters() {
    // Get the DAO context
    const context = useContext(DaoContext);

    return (
        <>
            <section>
                <h2>DAO smart contracts</h2>
                <ul className='parameters-list'>
                    <li>DAO governance: <TezosAddressLink address={DAO_CONTRACT_ADDRESS} /></li>
                    <li>DAO token: <TezosAddressLink address={context.storage?.token} /></li>
                    <li>DAO treasury: <TezosAddressLink address={context.storage?.treasury} /></li>
                    <li>DAO guardians: <TezosAddressLink address={context.storage?.guardians} /></li>
                    <li>DAO administrator: <TezosAddressLink address={context.storage?.administrator} /></li>
                    <li>Teia Community representatives: <TezosAddressLink address={context.storage?.representatives} /></li>
                    <li>DAO treasury balance: {context.balance ? context.balance / 1000000 : '0'} ꜩ</li>
                    <li>User token balance: {context.userTokenBalance ? context.userTokenBalance / 1000000 : '0'} TEIA tokens</li>
                </ul>
            </section>

            <section>
                <h2>Governance parameters</h2>
                <ul className='parameters-list'>
                    <li>Vote method: {context.storage?.governance_parameters.vote_method.linear ? 'linear weight' : 'quadratic weight'}</li>
                    <li>Required quorum: {context.storage?.quorum / 1000000} weighted votes</li>
                    <li>Percentage for supermajority: {context.storage?.governance_parameters.supermajority}%</li>
                    <li>Representatives vote share: {context.storage?.governance_parameters.representatives_share}%</li>
                    <li>Proposal voting period: {context.storage?.governance_parameters.vote_period} days</li>
                    <li>Proposal waiting period: {context.storage?.governance_parameters.wait_period} days</li>
                    <li>Number of tokens to escrow to submit a proposal: {context.storage?.governance_parameters.escrow_amount / 1000000} TEIA tokens</li>
                    <li>Minimum number of tokens required to vote a proposal: {context.storage?.governance_parameters.min_amount / 1000000} TEIA tokens</li>
                </ul>
            </section>
        </>
    );
}
