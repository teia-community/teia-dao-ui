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
    const { governanceParameters, proposals, userVotes, communityVotes } = useContext(DaoContext);

    // Separate the proposals depending of their current status
    const toVoteProposals = [];
    const votedProposals = [];
    const pendingEvaluationProposals = [];
    const waitingProposals = [];
    const toExecuteProposals = [];
    const executedProposals = [];
    const rejectedProposals = [];
    const cancelledProposals = [];

    if (governanceParameters && proposals) {
        // Loop over the complete list of proposals
        const now = new Date();

        for (const proposal of proposals) {
            // Get the vote and wait period parameters from the storage
            const proposalGovernanceParameters = governanceParameters[proposal.value.gp_index];
            const votePeriod = parseInt(proposalGovernanceParameters.vote_period);
            const waitPeriod = parseInt(proposalGovernanceParameters.wait_period);
            
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
                    Once the waiting phase finishes, you will be able to execute them.
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
            <ProposalInitialBlock
                id={props.proposalId}
                timestamp={props.proposal.timestamp}
            />
            <ProposalDescription
                id={props.proposalId}
                proposal={props.proposal}
            />
            <ProposalActions
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

function ProposalInitialBlock(props) {
    // Get the required DAO context information
    const { userTokenBalance, userVotes, communityVotes } = useContext(DaoContext);

    // Check if the user is a DAO member
    const isMember = userTokenBalance > 0;

    // Check if the user is a community representative
    const isRepresentative = communityVotes !== undefined;

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
                <span className={'user-votes' + voteClassName} />
            }

            {isRepresentative &&
                <span className={'user-votes' + communityVoteClassName} />
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
            <ProposalVotesSummary proposal={props.proposal} />
        </div>
    );
}

function ProposalDescriptionIntro(props) {
    // Get the proposal title and description
    const title = hexToString(props.proposal.title);
    const description = hexToString(props.proposal.description);

    // Try to extract an ipfs path from the proposal description
    const ipfsPath = description.split('/')[2];

    return (
        <>
            <p>
                <span className='proposal-id'>#{props.id}</span>
                <span className='proposal-title'>{title}</span>
            </p>
            <p>
                Issuer: <TezosAddressLink address={props.proposal.issuer} useAlias shorten />
            </p>
            <p>
                Description: {ipfsPath ? <IpfsLink path={ipfsPath}>ipfs</IpfsLink> : description}
            </p>
        </>
    );
}

function ProposalDescriptionContent(props) {
    // Write a different proposal description depending of the proposal kind
    const proposal = props.proposal;

    if (proposal.kind.text) {
        return (
            <p>
                Effect: Approves a text proposal.
            </p>
        );
    } else if (proposal.kind.transfer_mutez) {
        // Extract the transfers information
        const transfers = proposal.kind.transfer_mutez;
        const totalAmount = transfers.reduce((previous, current) => previous + parseInt(current.amount), 0);

        if (transfers.length === 1) {
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
    } else if (proposal.kind.transfer_token) {
        // Extract the transfers information
        const fa2 = proposal.kind.transfer_token.fa2;
        const tokenId = proposal.kind.transfer_token.token_id;
        const transfers = proposal.kind.transfer_token.distribution;
        const nEditions = transfers.reduce((previous, current) => previous + parseInt(current.amount), 0);
        const token = TOKENS.find(token => token.fa2 === fa2);

        if (transfers.length === 1) {
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

function ProposalVotesSummary(props) {
    // Get the required DAO context information
    const { governanceParameters} = useContext(DaoContext);

    // Get the proposal governance parameters
    const proposalGovernanceParameters = governanceParameters[props.proposal.gp_index];

    // Calculate the sum of the token and representatives votes
    let totalVotes = parseInt(props.proposal.token_votes.total);
    let positiveVotes = parseInt(props.proposal.token_votes.positive);
    let negativeVotes = parseInt(props.proposal.token_votes.negative);
    let abstainVotes = parseInt(props.proposal.token_votes.abstain);

    if (props.proposal.representatives_votes.total > 0) {
        const representativesTotalVotes = Math.floor(props.proposal.quorum * proposalGovernanceParameters.representatives_share / 100);
        totalVotes += representativesTotalVotes;
        positiveVotes += Math.floor(representativesTotalVotes * props.proposal.representatives_votes.positive / props.proposal.representatives_votes.total);
        negativeVotes += Math.floor(representativesTotalVotes * props.proposal.representatives_votes.negative / props.proposal.representatives_votes.total);
        abstainVotes += Math.floor(representativesTotalVotes * props.proposal.representatives_votes.abstain / props.proposal.representatives_votes.total);
    }

    // Check if the proposal passes the quorum and supermajority
    const quorum = props.proposal.quorum;
    const supermajority = proposalGovernanceParameters.supermajority / 100;
    const passesQuorum = totalVotes > quorum;
    const passesSupermajority = positiveVotes > Math.floor((positiveVotes + negativeVotes) * supermajority);

    // Calculate the number of votes needed to reach the quorum
    const requiredVotesForQuorum = passesQuorum ? 0 : (quorum - totalVotes);

    // Calculate the number of yes votes needed to reach supermajority
    const requiredYesVotesForSupermajority = passesSupermajority ? 0 : (negativeVotes === 0 ? TOKEN_DECIMALS : ((negativeVotes * supermajority / (1 - supermajority)) - positiveVotes));

    return (
        <div className='proposal-votes-summary'>
            <VotesDisplay
                title='Token votes:'
                yes={props.proposal.token_votes.positive / TOKEN_DECIMALS}
                no={props.proposal.token_votes.negative / TOKEN_DECIMALS}
                abstain={props.proposal.token_votes.abstain / TOKEN_DECIMALS}
            />
            <VotesDisplay
                title='Representatives votes:'
                yes={props.proposal.representatives_votes.positive}
                no={props.proposal.representatives_votes.negative}
                abstain={props.proposal.representatives_votes.abstain}
            />
            <VotesDisplay
                title='Combined votes:'
                yes={positiveVotes / TOKEN_DECIMALS}
                no={negativeVotes / TOKEN_DECIMALS}
                abstain={abstainVotes / TOKEN_DECIMALS}
            />
            <p>
                Passes supermajority condition? {passesSupermajority ? 'yes' : `no, ${Math.ceil(requiredYesVotesForSupermajority / TOKEN_DECIMALS)} yes votes still missing.`}
            </p>
            <p>
                Passes minimum quorum condition? {passesQuorum ? 'yes' : `no, ${Math.ceil(requiredVotesForQuorum / TOKEN_DECIMALS)} votes still missing.`}
            </p>
        </div>
    );
}

function VotesDisplay(props) {
    const totalVotes = parseInt(props.yes) + parseInt(props.no) + parseInt(props.abstain);
    const yesPercent = 100 * props.yes / totalVotes;
    const noPercent = 100 * props.no / totalVotes;
    const abstainPercent = 100 * props.abstain / totalVotes;

    return (
        <div className='votes-display'>
            <p className='votes-display-title'>
                {props.title}
            </p>
            <div className='votes-display-result'>
                {totalVotes === 0 &&
                    <div className='vote-display-nothing' style={{ width: '100%' }} >0</div>
                }
                {yesPercent > 0 &&
                    <div className='vote-display-yes' style={{ width: yesPercent + '%' }} >{Math.round(props.yes)}</div>
                }
                {noPercent > 0 &&
                    <div className='vote-display-no' style={{ width: noPercent + '%' }} >{Math.round(props.no)}</div>
                }
                {abstainPercent > 0 &&
                    <div className='vote-display-abstain' style={{ width: abstainPercent + '%' }} >{Math.round(props.abstain)}</div>
                }
            </div>
        </div>
    );
}

function ProposalActions(props) {
    // Get the DAO context
    const context = useContext(DaoContext);

    // Check if the user is a DAO member
    const isMember = context.userTokenBalance > 0;

    // Check if the user is a community representative
    const isRepresentative = context.communityVotes !== undefined;

    // Check if the user is the proposal issuer
    const isProposalIssuer = props.proposal.issuer === context.userAddress;

    // Check if the user can vote proposals
    const userCanVote = context.userTokenBalance >= context.governanceParameters[props.proposal.gp_index].min_amount;

    return (
        <div className='proposal-actions'>
            {props.canVote && userCanVote && !context.userVotes[props.id] &&
                <div>
                    <p>
                        Vote with your tokens:
                    </p>
                    <div className='proposal-action-buttons'>
                        <Button text='yes' onClick={() => context.voteProposal(props.id, 'yes')} />
                        <Button text='no' onClick={() => context.voteProposal(props.id, 'no')} />
                        <Button text='abstain' onClick={() => context.voteProposal(props.id, 'abstain')} />
                    </div>
                </div>
            }

            {props.canVote && isRepresentative && !context.communityVotes[props.id] &&
                <div>
                    <p>
                        Vote as representative:
                    </p>
                    <div className='proposal-actions-buttons'>
                        <Button text='yes' onClick={() => context.voteProposalAsRepresentative(props.id, 'yes')} />
                        <Button text='no' onClick={() => context.voteProposalAsRepresentative(props.id, 'no')} />
                        <Button text='abstain' onClick={() => context.voteProposalAsRepresentative(props.id, 'abstain')} />
                    </div>
                </div>
            }

            {props.canCancel && isProposalIssuer && !props.canEvaluate && !props.canExecute &&
                <div className='proposal-actions-buttons'>
                    <Button text='cancel' onClick={() => context.cancelProposal(props.id, true)} />
                </div>
            }

            {props.canEvaluate && isMember &&
                <div className='proposal-actions-buttons'>
                    {props.canCancel && isProposalIssuer &&
                        <Button text='cancel' onClick={() => context.cancelProposal(props.id, true)} />
                    }

                    <Button text='evaluate' onClick={() => context.evaluateVotingResult(props.id)} />
                </div>
            }

            {props.canExecute && isMember &&
                <div className='proposal-actions-buttons'>
                    {props.canCancel && isProposalIssuer &&
                        <Button text='cancel' onClick={() => context.cancelProposal(props.id, true)} />
                    }

                    <Button text='execute' onClick={() => context.executeProposal(props.id)} />
                </div>
            }
        </div>
    );
}
