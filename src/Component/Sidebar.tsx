// Sidebar.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Sidebar.css';

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
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span>Home</span>
                </button>

                <button
                    className="sidebar-btn files-btn"
                    title="Files"
                    onClick={onFilesClick}
                    aria-label="Files"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                    <span>Files</span>
                </button>
            </nav>
        </aside>
    );
};

export default Sidebar;
