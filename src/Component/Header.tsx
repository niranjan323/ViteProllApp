// Header.tsx
import { useState } from 'react';
import './Header.css';
import logo from '../assets/ABS_Logo.png';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

const handleMinimize = () => window.electronAPI?.minimizeWindow?.();
const handleMaximize = () => window.electronAPI?.maximizeWindow?.();
const handleClose = () => window.electronAPI?.closeWindow?.();

const Header = () => {
    const [showAbout, setShowAbout] = useState(false);

    const handleOpenUserGuide = () => {
        const documentUrl = '/ABS_Eagle_CRoll_User_Guide_v2026.1.pdf';
        if (isElectron) {
            window.electronAPI?.openPdfWindow?.(documentUrl);
        } else {
            window.open(documentUrl, '_blank');
        }
    };

    return (
        <>
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

                {/* | Eagle CRoll   Version: 2026.1.1 */}
                <span className="app-header__divider">|</span>
                <span className="app-header__title">Eagle CRoll</span>
                <span className="app-header__version">Version: 2026.1.1</span>
            </div>

            {/* RIGHT SIDE */}
            <div className="app-header__right">
                <div className="about-anchor">
                    <InfoOutlinedIcon
                        className="app-header__icon"
                        titleAccess="About"
                        onClick={() => setShowAbout(v => !v)}
                        style={{ cursor: 'pointer' }}
                    />

                    {/* About dropdown — anchored below info icon */}
                    {showAbout && (
                        <>
                        <div className="about-backdrop" onClick={() => setShowAbout(false)} />
                        <div className="about-modal">
                            <button className="about-close" onClick={() => setShowAbout(false)}>&#10005;</button>

                            <h2 className="about-heading">About</h2>

                            <div className="about-section">
                                <p className="about-app-name">ABS Eagle CRoll</p>
                                <p className="about-detail">Version: 2026.1.1</p>
                                <p className="about-detail">Build number: 20260415</p>
                                <p className="about-detail">Release date: May 2026</p>
                            </div>

                            <div className="about-section">
                                <p className="about-support-heading">Support</p>
                                <p className="about-detail">Email: <a href="mailto:engineeringappplications@eagle.org" className="about-link">engineeringappplications@eagle.org</a></p>
                                <p className="about-detail">Website: <a href="https://www.eagle.org" target="_blank" rel="noreferrer" className="about-link">www.eagle.org</a></p>
                            </div>

                            <button className="about-guide-btn" onClick={handleOpenUserGuide}>
                                Download user guide
                            </button>
                        </div>
                        </>
                    )}
                </div>

                {/* Window controls — Electron desktop only */}
                {isElectron && (
                    <div className="app-header__win-controls">
                        <button className="win-btn win-btn--min" onClick={handleMinimize} title="Minimize">&#8211;</button>
                        <button className="win-btn win-btn--max" onClick={handleMaximize} title="Maximize">&#9633;</button>
                        <button className="win-btn win-btn--close" onClick={handleClose} title="Close">&#10005;</button>
                    </div>
                )}
            </div>
        </header>
        </>
    );
};

export default Header;