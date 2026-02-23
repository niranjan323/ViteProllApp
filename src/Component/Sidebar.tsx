// Sidebar.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Sidebar.css';
import homeIcon from '../assets/home.svg';
import filesIcon from '../assets/files.svg';

interface SidebarProps
{
    onFilesClick?: () => void;
    onHomeClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onFilesClick, onHomeClick }) =>
{
    const navigate = useNavigate();

    const handleHomeClick = () =>
    {
        navigate('/');
        onHomeClick?.();
    };

    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
                <button
                    className="sidebar-btn home-btn"
                    title="Home"
                    onClick={handleHomeClick}
                    aria-label="Home"
                >
                    <img src={homeIcon} alt="Home" className="sidebar-icon" />
                    <span>Home</span>
                </button>

                <button
                    className="sidebar-btn files-btn"
                    title="Files"
                    onClick={onFilesClick}
                    aria-label="Files"
                >
                    <img src={filesIcon} alt="Files" className="sidebar-icon" />
                    <span>Files</span>
                </button>
            </nav>
        </aside>
    );
};

export default Sidebar;
