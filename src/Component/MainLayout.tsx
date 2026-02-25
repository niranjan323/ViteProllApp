// MainLayout.tsx (Main Layout Component)
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import './MainLayout.css';

const MainLayout: React.FC = () =>
{
    const handleHomeClick = () =>
    {
        console.log('Home clicked');
    };

    return (
        <div className="main-wrapper">
            {/* Header Component */}
            <Header />

            {/* Sidebar Component - Full Height */}
            <Sidebar
                onHomeClick={handleHomeClick}
            />

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