import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { DaoContext } from './context';
import { TezosAddressLink } from './links';
import { Button } from './button';


export function Header() {
    return (
        <header className='header-container'>
            <Navigation />
            <Wallet />
        </header>
    );
}

export function Navigation() {
    return (
        <nav>
            <ul>
                <li>
                    <NavLink to='/'>Home</NavLink>
                </li>
                <li>
                    <NavLink to='/proposals'>Proposals</NavLink>
                </li>
                <li>
                    <NavLink to='/create'>Create proposals</NavLink>
                </li>
            </ul>
        </nav>
    );
}

export function Wallet() {
    // Get the required DAO context information
    const { userAddress, connectWallet, disconnectWallet } = useContext(DaoContext);

    return (
        <div className='sync-container'>
            {userAddress &&
                <TezosAddressLink address={userAddress} shorten />
            }
            {userAddress ?
                <Button text='unsync' onClick={() => disconnectWallet()} /> :
                <Button text='sync' onClick={() => connectWallet()} />
            }
        </div>
    );
}
