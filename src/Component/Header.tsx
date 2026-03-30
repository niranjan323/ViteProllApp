// Header.tsx
import './Header.css';
import { useState } from 'react';
import logo from '../assets/ABS_Logo.png';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

const handleMinimize = () => window.electronAPI?.minimizeWindow?.();
const handleMaximize = () => window.electronAPI?.maximizeWindow?.();
const handleClose = () => window.electronAPI?.closeWindow?.();

const Header = () => {
    const [openModal, setOpenModal] = useState(false);

    const handleInfoClick = () => {
        setOpenModal(true);
    };

    const handleCloseModal = () => {
        setOpenModal(false);
    };

    const handleOpenPDF = () => {
        const documentUrl = '/ABS - Software Review Request Form - Eagle PRoll Diagram.pdf';
        
        if (isElectron) {
            // Use Electron API to open the PDF
            window.electronAPI?.openURL?.(documentUrl);
        } else {
            // For web/browser, use window.open
            window.open(documentUrl, '_blank');
        }
    };

    return (
        <header className="app-header">

            {/* LEFT SIDE */}
            <div className="app-header__left">

                {/* 9-dot grid icon */}
                <div className="app-header__grid-icon">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <span key={i} />
                    ))}
                </div>

                {/* ABS LOGO ONLY */}
                <img
                    src={logo}
                    alt="ABS"
                    className="app-header__logo"
                />

                {/* | PRoll Diagram App */}
                <span className="app-header__divider">|</span>
                <span className="app-header__title">PRoll Diagram App</span>
            </div>

            {/* RIGHT SIDE */}
            <div className="app-header__right">
                <InfoOutlinedIcon 
                    className="app-header__icon" 
                    titleAccess="User Guide" 
                    onClick={handleInfoClick}
                    style={{ cursor: 'pointer' }}
                />

                {/* Window controls — Electron desktop only */}
                {isElectron && (
                    <div className="app-header__win-controls">
                        <button className="win-btn win-btn--min" onClick={handleMinimize} title="Minimize">&#8211;</button>
                        <button className="win-btn win-btn--max" onClick={handleMaximize} title="Maximize">&#9633;</button>
                        <button className="win-btn win-btn--close" onClick={handleClose} title="Close">&#10005;</button>
                    </div>
                )}
            </div>

            {/* Info Modal Dialog */}
            <Dialog 
                open={openModal} 
                onClose={handleCloseModal}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>PRoll Diagram App User Guide</DialogTitle>
                <DialogContent>
                    <p style={{ marginTop: '16px', lineHeight: '1.6' }}>
                        Welcome to the ABS PRoll Diagram Application. This application helps you analyze and visualize roll data for marine vessels.
                    </p>
                    <p>
                        <strong>Features:</strong>
                    </p>
                    <ul>
                        <li>Load and analyze vessel data</li>
                        <li>View polar diagrams with real-time calculations</li>
                        <li>Interactive case management system</li>
                        <li>Export and save analysis results</li>
                    </ul>
                    <p>
                        Click the "View Full Guide" button below to access the complete PDF documentation.
                    </p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseModal}>Close</Button>
                    <Button onClick={handleOpenPDF} variant="contained" color="primary">
                        View Full Guide
                    </Button>
                </DialogActions>
            </Dialog>
        </header>
    );
};

export default Header;