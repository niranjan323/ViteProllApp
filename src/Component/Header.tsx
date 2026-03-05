// Header.tsx
import './Header.css';
import logo from '../assets/ABS_Logo.png';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const handleMinimize = () => window.electronAPI?.minimizeWindow?.();
const handleMaximize = () => window.electronAPI?.maximizeWindow?.();
const handleClose = () => window.electronAPI?.closeWindow?.();

const Header = () =>
{
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
                <InfoOutlinedIcon className="app-header__icon" title="User Guide" />

                {/* Window controls */}
                <div className="app-header__win-controls">
                    <button className="win-btn win-btn--min" onClick={handleMinimize} title="Minimize">&#8211;</button>
                    <button className="win-btn win-btn--max" onClick={handleMaximize} title="Maximize">&#9633;</button>
                    <button className="win-btn win-btn--close" onClick={handleClose} title="Close">&#10005;</button>
                </div>
            </div>

        </header>
    );
};

export default Header;