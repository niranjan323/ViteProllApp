// Sidebar.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Sidebar.css';
import homeIcon from '../assets/home.svg';

interface SidebarProps
{
    onHomeClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onHomeClick }) =>
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
            </nav>
        </aside>
    );
};

export default Sidebar;
