// MainLayout.tsx (Main Layout Component)
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import './MainLayout.css';
import { useElectron } from '../context/ElectronContext';

const MainLayout: React.FC = () =>
{
    const { isElectronMode } = useElectron();

    return (
        <div className="main-wrapper">
            {/* Header Component */}
            <Header />

            {/* Main Content Area - web mode gets overflow scroll at page level */}
            <main className={`content-area${isElectronMode ? '' : ' web-scroll'}`}>
                <Outlet />
                <footer className="app-footer">
                    <strong>&copy; 2026 American Bureau of Shipping. All rights reserved.</strong>
                </footer>
            </main>
        </div>
    );
};

export default MainLayout;
