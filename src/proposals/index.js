import React, { useContext } from 'react';
import { Parser, emitMicheline } from '@taquito/michel-codec';
import { encodePubKey } from '@taquito/utils';
import { DaoContext } from '../context';
import { Button } from '../button';
import { TezosAddressLink, TokenLink, IpfsLink } from '../link';
import { tokens, hexToString } from '../utils';


export function Proposals() {
    // Get the DAO context
    const context = useContext(DaoContext);

    // Separate the proposals depending of their current status
    const openProposals = [];
    const closedProposals = [];
    const approvedProposals = [];
    const executedProposals = [];
    const rejectedProposals = [];
    const cancelledProposals = [];

    if (context.proposals && context.storage) {
        // Get the vote period parameter from the storage
        const votePeriod = parseInt(context.storage.governance_parameters.vote_period);

        // Loop over the complete list of proposals
        const now = new Date();

        for (const proposal of context.proposals) {
            // Check if the proposal status is approved
            if (proposal.value.status.approved) {
                approvedProposals.push(proposal);
                continue;
            }

            // Check if the proposal status is executed
            if (proposal.value.status.executed) {
                executedProposals.push(proposal);
                continue;
            }

            // Check if the proposal status is rejected
            if (proposal.value.status.rejected) {
                rejectedProposals.push(proposal);
                continue;
            }

            // Check if the proposal status is cancelled
            if (proposal.value.status.cancelled) {
                cancelledProposals.push(proposal);
                continue;
            }

            // Check if the proposal voting period has expired
            const expirationDate = new Date(proposal.value.timestamp);
            expirationDate.setDate(expirationDate.getDate() + votePeriod);

            if (now > expirationDate) {
                closedProposals.push(proposal);
                continue;
            }

            // The proposal is still open
            openProposals.push(proposal);
        }
    }

	// Check if the user can vote
	var userCanVote = false;

	if (context.userTokenBalance && context.storage) {
		userCanVote = context.userTokenBalance > parseInt(context.storage.governance_parameters.min_amount);
	}

    return (
        <>
            <section>
                <h2>Proposals to vote</h2>
                <ProposalList proposals={openProposals} canVote={userCanVote} />
            </section>

            <section>
                <h2>Proposals pending result evaluatiaton</h2>
                <ProposalList proposals={closedProposals} />
            </section>

            <section>
                <h2>Proposals that can be executed</h2>
                <ProposalList proposals={approvedProposals} />
            </section>

            <section>
                <h2>Executed proposals</h2>
                <ProposalList proposals={executedProposals} />
            </section>

            <section>
                <h2>Rejected proposals</h2>
                <ProposalList proposals={rejectedProposals} />
            </section>

            <section>
                <h2>Cancelled proposals</h2>
                <ProposalList proposals={cancelledProposals} />
            </section>
        </>
    );
}

function ProposalList(props) {
    // Get the DAO context
    const context = useContext(DaoContext);

    // Get the minimum votes parameter from the storage
    const minimumVotes = parseInt(context.storage?.minimum_votes);

    return (
        <ul className='proposal-list'>
            {props.proposals.map((proposal) => (
                <li key={proposal.key}>
                    <Proposal
                        proposalId={proposal.key}
                        proposal={proposal.value}
                        vote={context.userVotes? context.userVotes[proposal.key] : undefined}
                        voteProposal={props.canVote? context.voteProposal : undefined}
                        executeProposal={(props.canVote && proposal.value.positive_votes >= minimumVotes)? context.executeProposal : undefined}
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
                vote={props.vote?.vote}
                voteProposal={props.voteProposal}
                executeProposal={props.executeProposal}
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
            <ProposalId id={props.id} />
            <ProposalDescriptionIntro proposal={props.proposal} />
            {' '}
            <ProposalDescriptionContent proposal={props.proposal} />
        </div>
    );
}

function ProposalId(props) {
    return (
        <span className='proposal-id'>#{props.id}</span>
    );
}

function ProposalDescriptionIntro(props) {
    return (
		<>
	        <p>
	        	Title: {hexToString(props.proposal.title)}
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

    if (kind.hasOwnProperty('text')) {
        return (
            <span>
                Effect: approve a <IpfsLink path={hexToString(proposal.description).split('/')[2]}>text proposal</IpfsLink>.
            </span>
        );
    }

    if (kind.hasOwnProperty('transfer_mutez')) {
        // Extract the transfers information
        const transfers = proposal.kind.transfer_mutez;
        const nTransfers = transfers.length;
        const totalAmount = transfers.reduce((previous, current) => previous + parseInt(current.amount), 0);

        if (nTransfers === 1) {
            return (
                <span>
                    Effect: transfer {transfers[0].amount / 1000000} ꜩ to <TezosAddressLink address={transfers[0].destination} useAlias shorten />.
                </span>
            );
        } else {
            return (
                <>
                    <span>
                        Effect: transfer {totalAmount / 1000000} ꜩ.
                    </span>
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
    }

    if (kind.hasOwnProperty('transfer_token')) {
        // Extract the transfers information
        const fa2 = proposal.kind.transfer_token.fa2;
        const tokenId = proposal.kind.transfer_token.token_id;
        const transfers = proposal.kind.transfer_token.distribution;
        const nTransfers = transfers.length;
        const nEditions = transfers.reduce((previous, current) => previous + parseInt(current.amount), 0);
        const token = tokens.find(token => token.fa2 === fa2);

        if (nTransfers === 1) {
            return (
                <span>
                    Effect: transfer {transfers[0].amount}
                    {' '}
                    {token?.multiasset? `edition${transfers[0].amount > 1? 's' : ''} of token` : ''}
                    {' '}
                    <TokenLink fa2={fa2} id={tokenId}>
                        {token? (token.multiasset? '#' + tokenId : token.name) : 'tokens'}
                    </TokenLink>
                    {' '}
                    to <TezosAddressLink address={transfers[0].destination} useAlias shorten />.
                </span>
            );
        } else {
            return (
                <>
                    <span>
                        Effect: transfer {nEditions}
                        {' '}
                        {token?.multiasset? 'editions of token' : ''}
                        {' '}
                        <TokenLink fa2={fa2} id={tokenId}>
                            {token? (token.multiasset? '#' + tokenId : token.name) : 'tokens'}
                        </TokenLink>.
                    </span>
                    <details>
                        <summary>See transfer details</summary>
                        <table>
                            <tbody>
                                {transfers.map((transfer, index) => (
                                    <tr key={index}>
                                        <td>
                                            {transfer.amount}
                                            {' '}
                                            {token?.multiasset? `edition${transfer.amount > 1? 's' : ''}` : ''} to
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
    }

    if (kind.hasOwnProperty('lambda_function')) {
        // Transform the lambda function Michelson JSON code to Micheline code
        const parser = new Parser();
        const michelsonCode = parser.parseJSON(JSON.parse(proposal.lambda_function));
        const michelineCode = emitMicheline(michelsonCode, {indent:'    ', newline: '\n',});

        // Encode any addresses that the Micheline code might contain
        const encodedMichelineCode = michelineCode.replace(
            /0x0[0123]{1}[\w\d]{42}/g,
            (match) => `"${encodePubKey(match.slice(2))}"`
        );

        return (
            <>
                <span>
                    Effect: execute a lambda function.
                </span>
                <details>
                    <summary>See Micheline code</summary>
                    <pre className='micheline-code'>
                        {encodedMichelineCode}
                    </pre>
                </details>
            </>
        );
    }

    return null;
}

function ProposalExtraInformation(props) {
    // Get the vote class name
    let voteClassName = '';

    if (props.vote !== undefined) {
        voteClassName = props.vote.yes? ' yes-vote' : (props.vote.no? ' no-vote' : ' abstain-vote');
    }

    return (
        <div className='proposal-extra-information'>
            {props.executeProposal &&
                <Button text='execute' onClick={() => props.executeProposal(props.id)} />
            }

            <span className={'proposal-votes' + voteClassName} />

            {props.voteProposal &&
                <Button text='YES' onClick={() => props.voteProposal(props.id, 'yes')} />
            }

            {props.voteProposal &&
                <Button text='NO' onClick={() => props.voteProposal(props.id, 'no')} />
            }

            {props.voteProposal &&
                <Button text='ABSTAIN' onClick={() => props.voteProposal(props.id, 'abstain')} />
            }
        </div>
    );
}
