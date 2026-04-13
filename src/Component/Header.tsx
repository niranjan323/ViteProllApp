// Header.tsx
import './Header.css';
import logo from '../assets/ABS_Logo.png';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

const handleMinimize = () => window.electronAPI?.minimizeWindow?.();
const handleMaximize = () => window.electronAPI?.maximizeWindow?.();
const handleClose = () => window.electronAPI?.closeWindow?.();

const Header = () => {
    const handleInfoClick = () => {
        const documentUrl = '/ABS_Eagle_PRoll_Diagram_user_Guide_v1.0 1.pdf';
        
        if (isElectron) {
            // Open PDF in a new independent Electron window
            window.electronAPI?.openPdfWindow?.(documentUrl);
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

                {/* | Eagle CRoll: Container Roll Diagram   Version: 2026.1 */}
                <span className="app-header__divider">|</span>
                <span className="app-header__title">Eagle CRoll</span>
                <span className="app-header__version">Version: 2026.1</span>
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
        </header>
    );
};

export default Header;