// Header.tsx
import { useEffect, useState } from 'react';
import './Header.css';
import logo from '../assets/ABS_Logo.png';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import aboutIcon from '../assets/about.svg';
import appIcon from '../assets/CRoll App icon.svg';
import versionIcon from '../assets/version.svg';
import buildIcon from '../assets/build.svg';
import dateIcon from '../assets/date.svg';
import emailIcon from '../assets/email.svg';
import websiteIcon from '../assets/website.svg';

type WebIdentity = {
    displayName: string;
    email: string;
};

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

const handleMinimize = () => window.electronAPI?.minimizeWindow?.();
const handleMaximize = () => window.electronAPI?.maximizeWindow?.();
const handleClose = () => window.electronAPI?.closeWindow?.();

// Rendered only in web mode — uses MSAL hooks (requires MsalProvider in tree)
function WebUserSection({ onIdentityChange }: { onIdentityChange: (identity: WebIdentity) => void }) {
    const isAuthenticated = useIsAuthenticated();
    const { instance, accounts } = useMsal();
    const [showMenu, setShowMenu] = useState(false);

    if (!isAuthenticated) return null;

    const user = accounts[0];
    const displayName = user?.name ?? user?.username ?? 'User';
    const email = user?.username ?? '';

    useEffect(() => {
        onIdentityChange({ displayName, email });
    }, [displayName, email, onIdentityChange]);

    const handleLogout = () => {
        setShowMenu(false);
        instance.logoutRedirect({
            account: instance.getActiveAccount() ?? accounts[0],
            postLogoutRedirectUri: window.location.origin,
        });
    };

    return (
        <div className="app-header__user" onClick={() => setShowMenu(v => !v)}>
            <div className="app-header__user-avatar">
                {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="app-header__user-name">{displayName}</span>
            {showMenu && (
                <>
                    <div className="user-menu-backdrop" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                    <div className="user-menu">
                        <div className="user-menu-info">
                            <strong>{displayName}</strong>
                            <span>{email}</span>
                        </div>
                        <hr className="user-menu-divider" />
                        <button className="user-menu-signout" onClick={handleLogout}>
                            Sign out
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

const Header = () => {
    const [showAbout, setShowAbout] = useState(false);
    const [webIdentity, setWebIdentity] = useState<WebIdentity>({ displayName: '', email: '' });

    const handleOpenUserGuide = async () => {
        const documentUrl = '/ABS Eagle CRoll User Guide v2026.1.1.pdf';
        
        if (isElectron) {
            // Open PDF in a new independent Electron window
            window.electronAPI?.openPdfWindow?.(documentUrl);
        } else {
            // Open the tab synchronously from the click event to avoid popup blocking.
            const guideWindow = window.open('', '_blank');
            if (!guideWindow) {
                console.error('Popup was blocked when opening the user guide window.');
                return;
            }

            try {
                const response = await fetch(documentUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch guide PDF: ${response.status}`);
                }

                const inputBytes = new Uint8Array(await response.arrayBuffer());
                const pdfDoc = await PDFDocument.load(inputBytes);
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

                const name = webIdentity.displayName || 'User';
                const id = webIdentity.email || 'unknown';
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, '0');
                const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
                const watermarkText = `Authorized to ABS Eagle CRoll software licensed user ${name} (${id}) only, ${timestamp}, copyright ${now.getUTCFullYear()} by ABS. All rights reserved.`;

                const fontSize = 8;
                const rightMargin = 6;
                pdfDoc.getPages().forEach((page, index) => {
                    if (index === 0) return; // keep cover page clean
                    const { width, height } = page.getSize();
                    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
                    page.drawText(watermarkText, {
                        x: width - fontSize - rightMargin,
                        y: (height + textWidth) / 2,
                        size: fontSize,
                        font,
                        color: rgb(0.38, 0.38, 0.38),
                        rotate: degrees(-90),
                        opacity: 0.85,
                    });
                });

                const watermarkedBytes = await pdfDoc.save();
                const byteArray = Array.from(watermarkedBytes);
                const blob = new Blob([new Uint8Array(byteArray)], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                guideWindow.location.replace(blobUrl);

                // Give the browser enough time to load the PDF, then revoke the URL.
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
            } catch (error) {
                console.error('Failed to open watermarked user guide:', error);
                guideWindow.location.replace(documentUrl);
            }
        }
    };

    const handleOpenWebsite = (url: string) => {
        if (isElectron) {
            // Open URL in default browser via Electron API
            window.electronAPI?.openURL?.(url);
        } else {
            // For web/browser, use window.open
            window.open(url, '_blank');
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
                {/* Logged-in user info — web only */}
                {!isElectron && <WebUserSection onIdentityChange={setWebIdentity} />}
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
                                    <span className="about-detail">Build number: 20260715</span>
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
                                    <p className="about-detail">Website:  <a href="#" onClick={(e) => { e.preventDefault(); handleOpenWebsite('https://www.eagle.org'); }} className="about-link">www.eagle.org</a></p>
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