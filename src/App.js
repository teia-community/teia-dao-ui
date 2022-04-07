import React from 'react';
import { Outlet } from 'react-router-dom';
import { DaoContextProvider } from './containers/context';
import { Header } from './containers/header';
import { Footer } from './containers/footer';
import { Parameters } from './containers/parameters';
import { Proposals } from './containers/proposals';
import { CreateProposalForms } from './containers/forms';


export function App() {
    return (
        <DaoContextProvider>
            <div className='app-container'>
                <Header />
                <Outlet />
                <Footer />
            </div>
        </DaoContextProvider>
    );
}

export function DaoParameters() {
    return (
        <main>
            <h1>Teia Community DAO</h1>
            <Parameters />
        </main>
    );
}

export function DaoProposals() {
    return (
        <main>
            <h1>DAO proposals</h1>
            <Proposals />
        </main>
    );
}

export function CreateProposals() {
    return (
        <main>
            <h1>Create new proposals</h1>
            <CreateProposalForms />
        </main>
    );
}

export function NotFound() {
    return (
        <main>
            <p>Page not found...</p>
        </main>
    );
}
