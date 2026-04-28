// Header.tsx
import { useState } from 'react';
import './Header.css';
import logo from '../assets/ABS_Logo.png';
import aboutIcon from '../assets/about.svg';
import appIcon from '../assets/CRoll App icon.svg';
import versionIcon from '../assets/version.svg';
import buildIcon from '../assets/build.svg';
import dateIcon from '../assets/date.svg';
import emailIcon from '../assets/email.svg';
import websiteIcon from '../assets/website.svg';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

const handleMinimize = () => window.electronAPI?.minimizeWindow?.();
const handleMaximize = () => window.electronAPI?.maximizeWindow?.();
const handleClose = () => window.electronAPI?.closeWindow?.();

const Header = () => {
    const [showAbout, setShowAbout] = useState(false);
    const handleOpenUserGuide = () => {
        const documentUrl = '/ABS Eagle CRoll User Guide v2026.1.1.pdf';
        
        if (isElectron) {
            // Open PDF in a new independent Electron window
            window.electronAPI?.openPdfWindow?.(documentUrl);
        } else {
            // For web/browser, use window.open
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

                {/* | CRoll */}
                <span className="app-header__divider">|</span>
                <span className="app-header__title">Eagle CRoll:</span>
                <span className="app-header__subtitle">Container Carrier Roll Motion in Operation</span>
                <span className="app-header__version">Version: 2026.1.1</span>
            </div>

            {/* RIGHT SIDE */}
            <div className="app-header__right">
                <div className="about-anchor">
                <img 
                    src={aboutIcon}
                    alt="About" 
                    className="app-header__icon" 
                    title="About"
                    onClick={() => setShowAbout(v => !v)}
                    style={{ cursor: 'pointer' }}
                />
                
                {/* About dropdown — anchored below info icon */}
                    {showAbout && (
                        <>
                        <div className="about-backdrop" onClick={() => setShowAbout(false)} />
                        <div className="about-modal">
                            <button className="about-close" onClick={() => setShowAbout(false)}>&#10005;</button>

                            {/* App icon + name header */}
                            <div className="about-app-header">
                                <img src={appIcon} alt="CRoll" className="about-app-icon" />
                                <span className="about-app-name">ABS Eagle CRoll</span>
                            </div>

                            <div className="about-section">
                                <div className="about-row">
                                    <img src={versionIcon} alt="" className="about-row-icon" />
                                    <span className="about-detail">Version: 2026.1.1</span>
                                </div>
                                <div className="about-row">
                                    <img src={buildIcon} alt="" className="about-row-icon" />
                                    <span className="about-detail">Build number: 20260415</span>
                                </div>
                                <div className="about-row">
                                    <img src={dateIcon} alt="" className="about-row-icon" />
                                    <span className="about-detail">Release date: July 2026</span>
                                </div>
                            </div>

                            <div className="about-section">
                                <p className="about-support-heading">Support</p>
                                <div className="about-row">
                                    <img src={emailIcon} alt="" className="about-row-icon" />
                                    <p className="about-detail">Email: <a href="mailto:engineeringappplications@eagle.org" className="about-link">engineeringappplications@eagle.org</a> </p>
                                </div>
                                <div className="about-row">
                                    <img src={websiteIcon} alt="" className="about-row-icon" />
                                    <p className="about-detail">Website:  <a href="https://www.eagle.org" target="_blank" rel="noreferrer" className="about-link">www.eagle.org</a></p>
                                </div>
                            </div>

                            <button className="about-guide-btn" onClick={handleOpenUserGuide}>
                                User Guide
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