import React, { useContext, useState } from 'react';
import { TOKEN_DECIMALS, TOKENS } from '../constants';
import { DaoContext } from './context';
import { Button } from './button';
import { IpfsLink } from './links';


export function CreateProposalForms() {
    // Get the DAO context
    const context = useContext(DaoContext);

    // Get the current governance parameters
    const currentGovernanceParameters = context.governanceParameters && context.governanceParameters[context.storage.gp_counter - 1];

    // Return if the user is not connected
    if (!context.userAddress) {
        return (
            <section>
                <p>You need to sync your wallet to be able to create proposals.</p>
            </section>
        );
    }

    // Return if the user doesn't have enough balance to create proposals
    if (!(currentGovernanceParameters?.escrow_amount <= context.userTokenBalance)) {
        return (
            <section>
                <p>
                    A minimum of
                    {' '}
                    {currentGovernanceParameters?.escrow_amount / TOKEN_DECIMALS}
                    {' '}
                    TEIA tokens are needed to create proposals.
                </p>
            </section>
        );
    }

    return (
        <>
            <section>
                <h2>Text proposal</h2>
                <p>
                    Use this form to create a proposal to approve a text or decission.
                </p>
                <p>
                    This proposal has no direct consequences on the blockchain. However, if accepted and executed,
                    it should trigger some off-chain actions by one of the Teia DAO members (e.g. change a website UI,
                    decide on a dog name, buy bread at the bakery).
                    The proposal description will be stored in IPFS for archival purposes.
                </p>
                <TextProposalForm handleSubmit={context.createTextProposal} />
            </section>

            <section>
                <h2>Transfer tez proposal</h2>
                <p>
                    Use this form to create a proposal that, if accepted, it will transfer
                    the specified amount of tez from the DAO treasury to a list of tezos addresses.
                    The proposal description will be stored in IPFS for archival purposes.
                </p>
                <TransferTezProposalForm handleSubmit={context.createTransferMutezProposal} />
            </section>

            <section>
                <h2>Transfer token proposal</h2>
                <p>
                    Use this form to create a proposal that, if accepted, it will transfer
                    the specified amount of token editions from the DAO treasury to a list of tezos addresses.
                    The proposal description will be stored in IPFS for archival purposes.
                </p>
                <TransferTokenProposalForm handleSubmit={context.createTransferTokenProposal} />
            </section>

            <section>
                <h2>Lambda function proposal</h2>
                <p>
                    Use this form to create a proposal that, if accepted, it will execute some smart contract code
                    stored in a Michelson lambda function.
                    The proposal description will be stored in IPFS for archival purposes.
                </p>
                <p>
                    This proposal could be used to administer other smart contracts of which the DAO is the administrator
                    (e.g. to update some smart contract fees), or to execute entry points from other contracts (e.g. swap
                    or collect a token, vote in anoter DAO / multisig).
                </p>
                <p className='create-proposal-warning'>
                    Warning: Executing arbitrary smart contract code could compromise the DAO or have unexpected
                    consequences. The lambda function code should have been revised by some trusted smart contract expert
                    before the proposal is accepted and executed.
                </p>
                <LambdaFunctionProposalForm handleSubmit={context.createLambdaFunctionProposal} />
            </section>
        </>
    );
}

function GeneralProposalInputs(props) {
    // Get the required DAO context information
    const { uploadFileToIpfs } = useContext(DaoContext);

    // Set the component state
    const [descriptionFile, setDescriptionFile] = useState(undefined);

    // Define the on change handler
    const handleChange = (e) => {
        setDescriptionFile(e.target.files[0]);
        props.setDescriptionIpfsPath(undefined);
    };

    // Define the on click handler
    const handleClick = async (e) => {
        e.preventDefault();

        // Update the component state
        props.setDescriptionIpfsPath(await uploadFileToIpfs(descriptionFile, true));
    };

    return (
        <>
            <label>Proposal title:
                {' '}
                <input
                    type='text'
                    spellCheck='false'
                    minLength='1'
                    value={props.title}
                    onChange={(e) => props.setTitle(e.target.value)}
                />
            </label>
            <br />
            <label>Proposal description:
                {' '}
                <input
                    type='file'
                    onChange={handleChange}
                />
            </label>
            {descriptionFile &&
                <div>
                    <Button text={props.descriptionIpfsPath ? 'uploaded' : 'upload to IPFS'} onClick={handleClick} />
                    {' '}
                    {props.descriptionIpfsPath &&
                        <IpfsLink path={props.descriptionIpfsPath} />
                    }
                </div>
            }
        </>
    );
}

function TextProposalForm(props) {
    // Set the component state
    const [title, setTitle] = useState('');
    const [descriptionIpfsPath, setDescriptionIpfsPath] = useState(undefined);

    // Define the on submit handler
    const handleSubmit = (e) => {
        e.preventDefault();
        props.handleSubmit(title, descriptionIpfsPath);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className='form-input'>
                <GeneralProposalInputs
                    title={title}
                    setTitle={setTitle}
                    descriptionIpfsPath={descriptionIpfsPath}
                    setDescriptionIpfsPath={setDescriptionIpfsPath}
                />
            </div>
            <input type='submit' value='send proposal' />
        </form>
    );
}

function TransferTezProposalForm(props) {
    // Set the component state
    const [title, setTitle] = useState('');
    const [descriptionIpfsPath, setDescriptionIpfsPath] = useState(undefined);
    const [transfers, setTransfers] = useState([
        { amount: 0, destination: '' }
    ]);

    // Define the on change handler
    const handleChange = (index, parameter, value) => {
        // Create a new transfers array
        const newTransfers = transfers.map((transfer, i) => {
            // Create a new transfer
            const newTransfer = {
                amount: transfer.amount,
                destination: transfer.destination
            };

            // Update the value if we are at the correct index position
            if (i === index) {
                newTransfer[parameter] = value;
            }

            return newTransfer;
        });

        // Update the component state
        setTransfers(newTransfers);
    };

    // Define the on click handler
    const handleClick = (e, increase) => {
        e.preventDefault();

        // Create a new transfers array
        const newTransfers = transfers.map((transfer) => (
            { amount: transfer.amount, destination: transfer.destination }
        ));

        // Add or remove a transfer from the list
        if (increase) {
            newTransfers.push({ amount: 0, destination: '' });
        } else if (newTransfers.length > 1) {
            newTransfers.pop();
        }

        // Update the component state
        setTransfers(newTransfers);
    };

    // Define the on submit handler
    const handleSubmit = (e) => {
        e.preventDefault();
        props.handleSubmit(
            title,
            descriptionIpfsPath,
            transfers.map((transfer) => ({
                amount: transfer.amount * 1000000,
                destination: transfer.destination
            }))
        );
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className='form-input'>
                <GeneralProposalInputs
                    title={title}
                    setTitle={setTitle}
                    descriptionIpfsPath={descriptionIpfsPath}
                    setDescriptionIpfsPath={setDescriptionIpfsPath}
                />
                <br />
                <div className='transfers-input'>
                    {transfers.map((transfer, index) => (
                        <div key={index} className='transfer-input'>
                            <label>Amount to transfer (ꜩ):
                                {' '}
                                <input
                                    type='number'
                                    min='0'
                                    step='0.000001'
                                    value={transfer.amount}
                                    onChange={(e) => handleChange(index, 'amount', e.target.value)}
                                />
                            </label>
                            <br />
                            <label>Destination address:
                                {' '}
                                <input
                                    type='text'
                                    spellCheck='false'
                                    minLength='36'
                                    maxLength='36'
                                    className='tezos-wallet-input'
                                    value={transfer.destination}
                                    onChange={(e) => handleChange(index, 'destination', e.target.value)}
                                />
                            </label>
                        </div>
                    ))}
                </div>
                <Button text='+' onClick={(e) => handleClick(e, true)} />
                {' '}
                <Button text='-' onClick={(e) => handleClick(e, false)} />
            </div>
            <input type='submit' value='send proposal' />
        </form>
    );
}

function TransferTokenProposalForm(props) {
    // Set the component state
    const [title, setTitle] = useState('');
    const [descriptionIpfsPath, setDescriptionIpfsPath] = useState(undefined);
    const [tokenContract, setTokenContract] = useState('');
    const [tokenId, setTokenId] = useState('');
    const [transfers, setTransfers] = useState([
        { amount: 0, destination: '' }
    ]);

    // Define the on change handler
    const handleChange = (index, parameter, value) => {
        // Create a new transfers array
        const newTransfers = transfers.map((transfer, i) => {
            // Create a new transfer
            const newTransfer = {
                amount: transfer.amount,
                destination: transfer.destination
            };

            // Update the value if we are at the correct index position
            if (i === index) {
                newTransfer[parameter] = value;
            }

            return newTransfer;
        });

        // Update the component state
        setTransfers(newTransfers);
    };

    // Define the on click handler
    const handleClick = (e, increase) => {
        e.preventDefault();

        // Create a new transfers array
        const newTransfers = transfers.map(transfer => (
            { amount: transfer.amount, destination: transfer.destination }
        ));

        // Add or remove a transfer from the list
        if (increase) {
            newTransfers.push({ amount: 0, destination: '' });
        } else if (newTransfers.length > 1) {
            newTransfers.pop();
        }

        // Update the component state
        setTransfers(newTransfers);
    };

    // Define the on submit handler
    const handleSubmit = (e) => {
        e.preventDefault();

        // Create a new transfers array that makes use of the correct decimals
        const token = TOKENS.find(token => token.fa2 === tokenContract);
        const newTransfers = transfers.map(transfer => (
            { amount: token ? transfer.amount * token.decimals : transfer.amount, destination: transfer.destination }
        ));

        // Submit the proposal
        props.handleSubmit(title, descriptionIpfsPath, tokenContract, tokenId, newTransfers);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className='form-input'>
                <GeneralProposalInputs
                    title={title}
                    setTitle={setTitle}
                    descriptionIpfsPath={descriptionIpfsPath}
                    setDescriptionIpfsPath={setDescriptionIpfsPath}
                />
                <br />
                <label>Token contract address:
                    {' '}
                    <input
                        type='text'
                        list='tokenContracts'
                        spellCheck='false'
                        minLength='36'
                        maxLength='36'
                        className='contract-address-input'
                        value={tokenContract}
                        onMouseDown={() => setTokenContract('')}
                        onChange={(e) => setTokenContract(e.target.value)}
                    />
                    <datalist id='tokenContracts'>
                        <option value=''></option>
                        {TOKENS.map((token) => (
                            <option key={token.fa2} value={token.fa2}>{token.name}</option>
                        ))}
                    </datalist>
                </label>
                <br />
                <label>Token Id:
                    {' '}
                    <input
                        type='number'
                        min='0'
                        step='1'
                        value={tokenId}
                        onChange={(e) => setTokenId(e.target.value)}
                    />
                </label>
                <br />
                <div className='transfers-input'>
                    {transfers.map((transfer, index) => (
                        <div key={index} className='transfer-input'>
                            <label>Token editions:
                                {' '}
                                <input
                                    type='number'
                                    min='1'
                                    step='1'
                                    value={transfer.amount}
                                    onChange={(e) => handleChange(index, 'amount', e.target.value)}
                                />
                            </label>
                            <br />
                            <label>Destination address:
                                {' '}
                                <input
                                    type='text'
                                    spellCheck='false'
                                    minLength='36'
                                    maxLength='36'
                                    className='tezos-wallet-input'
                                    value={transfer.destination}
                                    onChange={(e) => handleChange(index, 'destination', e.target.value)}
                                />
                            </label>
                        </div>
                    ))}
                </div>
                <Button text='+' onClick={(e) => handleClick(e, true)} />
                {' '}
                <Button text='-' onClick={(e) => handleClick(e, false)} />
            </div>
            <input type='submit' value='send proposal' />
        </form>
    );
}

function LambdaFunctionProposalForm(props) {
    // Set the component state
    const [title, setTitle] = useState('');
    const [descriptionIpfsPath, setDescriptionIpfsPath] = useState(undefined);
    const [michelineCode, setMichelineCode] = useState('');

    // Define the on change handler
    const handleChange = (e) => {
        setMichelineCode(e.target.value);
    };

    // Define the on submit handler
    const handleSubmit = (e) => {
        e.preventDefault();
        props.handleSubmit(title, descriptionIpfsPath, michelineCode);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className='form-input'>
                <GeneralProposalInputs
                    title={title}
                    setTitle={setTitle}
                    descriptionIpfsPath={descriptionIpfsPath}
                    setDescriptionIpfsPath={setDescriptionIpfsPath}
                />
                <br />
                <label className='form-input'>Lambda function code in Micheline format:
                    {' '}
                    <textarea
                        className='micheline-code'
                        spellCheck='false'
                        value={michelineCode}
                        onChange={handleChange}
                    />
                </label>
            </div>
            <input type='submit' value='send proposal' />
        </form>
    );
}
