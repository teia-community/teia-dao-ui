import React, { useContext } from 'react';
import { Parser, emitMicheline } from '@taquito/michel-codec';
import { encodePubKey } from '@taquito/utils';
import { TOKENS } from '../constants';
import { DaoContext } from './context';
import { Button } from './button';
import { TezosAddressLink, TokenLink, IpfsLink } from './links';
import { hexToString } from './utils';


export function Proposals() {
    // Get the required DAO context information
    const { storage, proposals, userVotes } = useContext(DaoContext);

    // Separate the proposals depending of their current status
    const toVoteProposals = [];
    const votedProposals = [];
    const pendingEvaluationProposals = [];
    const waitingProposals = [];
    const toExecuteProposals = [];
    const executedProposals = [];
    const rejectedProposals = [];
    const cancelledProposals = [];

    if (storage && proposals) {
        // Get the vote and wait period parameters from the storage
        const votePeriod = parseInt(storage.governance_parameters.vote_period);
        const waitPeriod = parseInt(storage.governance_parameters.wait_period);

        // Loop over the complete list of proposals
        const now = new Date();

        for (const proposal of proposals) {
            if (proposal.value.status.open) {
                // Check if the proposal voting period has expired
                const voteExpirationTime = new Date(proposal.value.timestamp);
                voteExpirationTime.setDate(voteExpirationTime.getDate() + votePeriod);

                if (now > voteExpirationTime) {
                    pendingEvaluationProposals.push(proposal);
                } else if (userVotes && userVotes[proposal.key]) {
                    votedProposals.push(proposal);
                } else {
                    toVoteProposals.push(proposal);
                }
            } else if (proposal.value.status.approved) {
                // Check if the proposal waiting period has passed or not
                const waitExpirationTime = new Date(proposal.value.timestamp);
                waitExpirationTime.setDate(waitExpirationTime.getDate() + votePeriod + waitPeriod);

                if (now > waitExpirationTime) {
                    toExecuteProposals.push(proposal);
                } else {
                    waitingProposals.push(proposal);
                }
            } else if (proposal.value.status.executed) {
                executedProposals.push(proposal);
            } else if (proposal.value.status.rejected) {
                rejectedProposals.push(proposal);
            } else if (proposal.value.status.cancelled) {
                cancelledProposals.push(proposal);
            }
        }
    }

    return (
        <>
            <section>
                <h2>Proposals to vote</h2>
                <p>
                    These proposals are still in the voting phase and you didn't vote for them yet.
                </p>
                <ProposalList proposals={toVoteProposals} canVote canCancel />
            </section>

            <section>
                <h2>Already voted proposals</h2>
                <p>
                    These proposals are still in the voting phase, but you already voted them.
                </p>
                <ProposalList proposals={votedProposals} canCancel />
            </section>

            <section>
                <h2>Proposals pending votes results evaluation</h2>
                <p>
                    The voting period for these proposals has finished.
                    You can evaluate their result to see if they are approved or rejected.
                </p>
                <ProposalList proposals={pendingEvaluationProposals} canEvaluate canCancel />
            </section>

            <section>
                <h2>Approved proposals</h2>
                <p>
                    These are approved proposals that are still in the waiting phase.
                </p>
                <ProposalList proposals={waitingProposals} canCancel />
            </section>

            <section>
                <h2>Proposals to execute</h2>
                <p>
                    These are approved proposals that can be exectuded.
                </p>
                <ProposalList proposals={toExecuteProposals} canExecute canCancel />
            </section>

            <section>
                <h2>Executed proposals</h2>
                <p>
                    These proposals have been executed already.
                </p>
                <ProposalList proposals={executedProposals} />
            </section>

            <section>
                <h2>Rejected proposals</h2>
                <p>
                    These proposals didn't reach the required quorum and/or supermajority.
                    As a result, they were rejected by the DAO.
                </p>
                <ProposalList proposals={rejectedProposals} />
            </section>

            <section>
                <h2>Cancelled proposals</h2>
                <p>
                    These proposals were cancelled by the proposal issuer or the DAO guardians.
                </p>
                <ProposalList proposals={cancelledProposals} />
            </section>
        </>
    );
}

function ProposalList(props) {
    return (
        <ul className='proposal-list'>
            {props.proposals.map((proposal) => (
                <li key={proposal.key}>
                    <Proposal
                        proposalId={proposal.key}
                        proposal={proposal.value}
                        canVote={props.canVote}
                        canCancel={props.canCancel}
                        canEvaluate={props.canEvaluate}
                        canExecute={props.canExecute}
                    />
                </li>
            ))}
        </ul>
    );
}

function Proposal(props) {
    return (
        <div className='proposal'>
            <ProposalTimestamp timestamp={props.proposal.timestamp} />
            <ProposalDescription
                id={props.proposalId}
                proposal={props.proposal} />
            <ProposalExtraInformation
                id={props.proposalId}
                proposal={props.proposal}
                canVote={props.canVote}
                canCancel={props.canCancel}
                canEvaluate={props.canEvaluate}
                canExecute={props.canExecute}
            />
        </div>
    );
}

function ProposalTimestamp(props) {
    return (
        <span className='proposal-timestamp'>{props.timestamp}</span>
    );
}

function ProposalDescription(props) {
    return (
        <div className='proposal-description'>
            <ProposalDescriptionIntro id={props.id} proposal={props.proposal} />
            {' '}
            <ProposalDescriptionContent proposal={props.proposal} />
        </div>
    );
}

function ProposalDescriptionIntro(props) {
    return (
        <>
            <p>
                <span className='proposal-id'>#{props.id}</span>
                <span className='proposal-title'>{hexToString(props.proposal.title)}</span>
            </p>
            <p>
                Issuer: <TezosAddressLink address={props.proposal.issuer} useAlias shorten />
            </p>
            <p>
                Description: <IpfsLink path={hexToString(props.proposal.description).split('/')[2]}>ipfs</IpfsLink>
            </p>
        </>
    );
}

function ProposalDescriptionContent(props) {
    // Write a different proposal description depending of the proposal kind
    const proposal = props.proposal;
    const kind = proposal.kind;

    if (kind.text) {
        return (
            <p>
                Effect: Approves a <IpfsLink path={hexToString(proposal.description).split('/')[2]}>text proposal</IpfsLink>.
            </p>
        );
    } else if (kind.transfer_mutez) {
        // Extract the transfers information
        const transfers = proposal.kind.transfer_mutez;
        const nTransfers = transfers.length;
        const totalAmount = transfers.reduce((previous, current) => previous + parseInt(current.amount), 0);

        if (nTransfers === 1) {
            return (
                <p>
                    Effect: Transfers {transfers[0].amount / 1000000} ꜩ to <TezosAddressLink address={transfers[0].destination} useAlias shorten />.
                </p>
            );
        } else {
            return (
                <>
                    <p>
                        Effect: Transfers {totalAmount / 1000000} ꜩ.
                    </p>
                    <details>
                        <summary>See transfer details</summary>
                        <table>
                            <tbody>
                                {transfers.map((transfer, index) => (
                                    <tr key={index}>
                                        <td>
                                            {transfer.amount / 1000000} ꜩ to
                                        </td>
                                        <td>
                                            <TezosAddressLink address={transfer.destination} useAlias shorten />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </details>
                </>
            );
        }
    } else if (kind.transfer_token) {
        // Extract the transfers information
        const fa2 = proposal.kind.transfer_token.fa2;
        const tokenId = proposal.kind.transfer_token.token_id;
        const transfers = proposal.kind.transfer_token.distribution;
        const nTransfers = transfers.length;
        const nEditions = transfers.reduce((previous, current) => previous + parseInt(current.amount), 0);
        const token = TOKENS.find(token => token.fa2 === fa2);

        if (nTransfers === 1) {
            return (
                <p>
                    Effect: Transfers {transfers[0].amount}
                    {' '}
                    {token?.multiasset ? `edition${transfers[0].amount > 1 ? 's' : ''} of token` : ''}
                    {' '}
                    <TokenLink fa2={fa2} id={tokenId}>
                        {token ? (token.multiasset ? '#' + tokenId : token.name) : 'tokens'}
                    </TokenLink>
                    {' '}
                    to <TezosAddressLink address={transfers[0].destination} useAlias shorten />.
                </p>
            );
        } else {
            return (
                <>
                    <p>
                        Effect: Transfers {nEditions}
                        {' '}
                        {token?.multiasset ? 'editions of token' : ''}
                        {' '}
                        <TokenLink fa2={fa2} id={tokenId}>
                            {token ? (token.multiasset ? '#' + tokenId : token.name) : 'tokens'}
                        </TokenLink>.
                    </p>
                    <details>
                        <summary>See transfer details</summary>
                        <table>
                            <tbody>
                                {transfers.map((transfer, index) => (
                                    <tr key={index}>
                                        <td>
                                            {transfer.amount}
                                            {' '}
                                            {token?.multiasset ? `edition${transfer.amount > 1 ? 's' : ''}` : ''} to
                                        </td>
                                        <td>
                                            <TezosAddressLink address={transfer.destination} useAlias shorten />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </details>
                </>
            );
        }
    } else {
        // Transform the lambda function Michelson JSON code to Micheline code
        const parser = new Parser();
        const michelsonCode = parser.parseJSON(JSON.parse(proposal.kind.lambda_function));
        const michelineCode = emitMicheline(michelsonCode, { indent: '    ', newline: '\n', });

        // Encode any addresses that the Micheline code might contain
        const encodedMichelineCode = michelineCode.replace(
            /0x0[0123]{1}[\w\d]{42}/g,
            (match) => `"${encodePubKey(match.slice(2))}"`
        );

        return (
            <>
                <p>
                    Effect: Executes a lambda function.
                </p>
                <details>
                    <summary>See Micheline code</summary>
                    <pre className='micheline-code'>
                        {encodedMichelineCode}
                    </pre>
                </details>
            </>
        );
    }
}

function ProposalExtraInformation(props) {
    // Get the DAO context
    const context = useContext(DaoContext);

    // Check if the user is a DAO member
    const isMember = context.userTokenBalance > 0;

    // Check if the user is the proposal issuer
    const isProposalIssuer = props.proposal.issuer === context.userAddress;

    // Check if the user can vote proposals
    const userCanVote = context.userTokenBalance > context.storage.governance_parameters.min_amount;

    // Get the user vote and the vote class name
    const userVote = context.userVotes && context.userVotes[props.id]?.vote;
    let voteClassName = '';

    if (userVote) {
        voteClassName = userVote.yes ? ' yes-vote' : (userVote.no ? ' no-vote' : ' abstain-vote');
    }

    return (
        <div className='proposal-extra-information'>
            {isProposalIssuer && props.canCancel &&
                <Button text='cancel' onClick={() => context.cancelProposal(props.id, true)} />
            }

            {userCanVote && props.canVote &&
                <Button text='yes' onClick={() => context.voteProposal(props.id, 'yes')} />
            }

            {userCanVote && props.canVote &&
                <Button text='no' onClick={() => context.voteProposal(props.id, 'no')} />
            }

            {userCanVote && props.canVote &&
                <Button text='abstain' onClick={() => context.voteProposal(props.id, 'abstain')} />
            }

            {isMember && props.canEvaluate &&
                <Button text='evaluate' onClick={() => context.evaluateVotingResult(props.id)} />
            }

            {isMember && props.canExecute &&
                <Button text='execute' onClick={() => context.executeProposal(props.id)} />
            }

            {isMember &&
                <span className={'proposal-votes' + voteClassName} />
            }
        </div>
    );
}
