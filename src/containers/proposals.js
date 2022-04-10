import React, { useContext } from 'react';
import { Parser, emitMicheline } from '@taquito/michel-codec';
import { encodePubKey } from '@taquito/utils';
import { TOKEN_DECIMALS, TOKENS } from '../constants';
import { DaoContext } from './context';
import { Button } from './button';
import { TezosAddressLink, TokenLink, IpfsLink } from './links';
import { hexToString } from './utils';


export function Proposals() {
    // Get the required DAO context information
    const { storage, proposals, userVotes, communityVotes } = useContext(DaoContext);

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
                    if (communityVotes && !communityVotes[proposal.key]) {
                        toVoteProposals.push(proposal);
                    } else {
                        votedProposals.push(proposal);
                    }
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
            <ProposalLeftBlock
                id={props.proposalId}
                timestamp={props.proposal.timestamp}
            />
            <ProposalDescription
                id={props.proposalId}
                proposal={props.proposal} />
            <ProposalRightBlock
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

function ProposalLeftBlock(props) {
    // Get the DAO context
    const { userTokenBalance, userVotes, communityVotes } = useContext(DaoContext);

    // Check if the user is a DAO member
    const isMember = userTokenBalance > 0;

    // Check if the user is a community representative
    const userIsRepresentative = communityVotes != undefined;

    // Get the user vote and the vote class name
    const userVote = userVotes && userVotes[props.id]?.vote;
    let voteClassName = '';

    if (userVote) {
        voteClassName = userVote.yes ? ' yes-vote' : (userVote.no ? ' no-vote' : ' abstain-vote');
    }

    // Get the community vote and the community vote class name
    const communityVote = communityVotes && communityVotes[props.id];
    let communityVoteClassName = '';

    if (communityVote) {
        communityVoteClassName = communityVote.yes ? ' yes-vote' : (communityVote.no ? ' no-vote' : ' abstain-vote');
    }

    return (
        <div>
            <p className='proposal-timestamp'>{props.timestamp}</p>
            {isMember &&
                <span className={'proposal-votes' + voteClassName}></span>
            }
            {userIsRepresentative &&
                <span className={'proposal-votes' + communityVoteClassName}></span>
            }
        </div>
    );
}

function ProposalDescription(props) {
    return (
        <div className='proposal-description'>
            <ProposalDescriptionIntro id={props.id} proposal={props.proposal} />
            {' '}
            <ProposalDescriptionContent proposal={props.proposal} />
            {' '}
            <ProposalVotes
                tokenVotes={props.proposal.token_votes}
                representativesVotes={props.proposal.representatives_votes}
            />
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

function ProposalVotes(props) {
    // Get the DAO context
    const { storage } = useContext(DaoContext);

    // Calculate the representatives votes based in the current quorum
    let representativesTotalVotes = 0;
    let representativesPositiveVotes = 0;
    let representativesNegativeVotes = 0;
    let representativesAbstainVotes = 0;

    if (props.representativesVotes.total > 0) {
        representativesTotalVotes = Math.floor(storage.quorum * storage.governance_parameters.representatives_share / 100);
        representativesPositiveVotes = Math.floor(representativesTotalVotes * parseInt(props.representativesVotes.positive) / parseInt(props.representativesVotes.total));
        representativesNegativeVotes = Math.floor(representativesTotalVotes * props.representativesVotes.negative / props.representativesVotes.total);
        representativesAbstainVotes = Math.floor(representativesTotalVotes * props.representativesVotes.abstain / props.representativesVotes.total);
    }

    // Calculate the sum of the token and representatives votes
    const totalVotes = representativesTotalVotes + parseInt(props.tokenVotes.total);
    const positiveVotes = representativesPositiveVotes + parseInt(props.tokenVotes.positive);
    const negativeVotes = representativesNegativeVotes + parseInt(props.tokenVotes.negative);
    const abstainVotes = representativesAbstainVotes + parseInt(props.tokenVotes.abstain);

    return (
        <>
            <p>
                Token votes:
                {' '}
                {props.tokenVotes.positive / TOKEN_DECIMALS} yes,
                {' '}
                {props.tokenVotes.negative / TOKEN_DECIMALS} no,
                {' '}
                {props.tokenVotes.abstain / TOKEN_DECIMALS} abstain.
            </p>
            <p>
                Representatives votes:
                {' '}
                {props.representativesVotes.positive} yes,
                {' '}
                {props.representativesVotes.negative} no,
                {' '}
                {props.representativesVotes.abstain} abstain.
            </p>
            <p>
                Combined votes:
                {' '}
                {positiveVotes / TOKEN_DECIMALS} yes,
                {' '}
                {negativeVotes / TOKEN_DECIMALS} no,
                {' '}
                {abstainVotes / TOKEN_DECIMALS} abstain.
            </p>
        </>
    );
}

function ProposalRightBlock(props) {
    // Get the DAO context
    const context = useContext(DaoContext);

    // Check if the user is a DAO member
    const isMember = context.userTokenBalance > 0;

    // Check if the user can vote proposals
    const userCanVote = context.userTokenBalance > context.storage.governance_parameters.min_amount;

    // Check if the user is a community representative
    const userIsRepresentative = context.communityVotes != undefined;

    // Check if the user is the proposal issuer
    const isProposalIssuer = props.proposal.issuer === context.userAddress;

    return (
        <div className='proposal-extra-information'>
            {props.canVote && userCanVote && !context.userVotes[props.id] &&
                <div>
                    <p>
                        Vote with your tokens:
                    </p>
                    <div className='proposal-actions'>
                        <Button text='yes' onClick={() => context.voteProposal(props.id, 'yes')} />
                        <Button text='no' onClick={() => context.voteProposal(props.id, 'no')} />
                        <Button text='abstain' onClick={() => context.voteProposal(props.id, 'abstain')} />
                    </div>
                </div>
            }

            {props.canVote && userIsRepresentative && !context.communityVotes[props.id] &&
                <div>
                    <p>
                        Vote as representative:
                    </p>
                    <div className='proposal-actions'>
                        <Button text='yes' onClick={() => context.voteProposalAsRepresentative(props.id, 'yes')} />
                        <Button text='no' onClick={() => context.voteProposalAsRepresentative(props.id, 'no')} />
                        <Button text='abstain' onClick={() => context.voteProposalAsRepresentative(props.id, 'abstain')} />
                    </div>
                </div>
            }

            {props.canCancel && isProposalIssuer && !props.canEvaluate && !props.canExecute &&
                <div className='proposal-actions'>
                    <Button text='cancel' onClick={() => context.cancelProposal(props.id, true)} />
                </div>
            }

            {props.canEvaluate && isMember &&
                <div className='proposal-actions'>
                    {props.canCancel && isProposalIssuer &&
                        <Button text='cancel' onClick={() => context.cancelProposal(props.id, true)} />
                    }

                    <Button text='evaluate' onClick={() => context.evaluateVotingResult(props.id)} />
                </div>
            }

            {props.canExecute && isMember &&
                <div className='proposal-actions'>
                    {props.canCancel && isProposalIssuer &&
                        <Button text='cancel' onClick={() => context.cancelProposal(props.id, true)} />
                    }

                    <Button text='execute' onClick={() => context.executeProposal(props.id)} />
                </div>
            }
        </div>
    );
}
