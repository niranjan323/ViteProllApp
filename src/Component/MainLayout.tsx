// MainLayout.tsx (Main Layout Component)
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import './MainLayout.css';

const MainLayout: React.FC = () =>
{
    return (
        <div className="main-wrapper">
            {/* Header Component */}
            <Header />

            {/* Main Content Area - Router Outlet will render pages here */}
            <main className="content-area">
                <Outlet />
                <footer className="app-footer">
                    <strong>&copy; 2026 American Bureau of Shipping. All rights reserved.</strong>
                </footer>
            </main>
        </div>
    );
};

export default MainLayout;
