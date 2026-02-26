import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import absLogo from '../assets/ABS_Logo.png';
import { useElectron } from '../context/ElectronContext';
import { useUserData } from '../context/UserDataContext';

const Home: React.FC = () =>
{
    const navigate = useNavigate();
    const { selectFolder, loadControlFile, selectedFolder: electronFolder } = useElectron();
    const { setSelectedFolder } = useUserData();
    const [ activeTab, setActiveTab ] = useState('project');
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState('');
    const [ success, setSuccess ] = useState('');

    // Sync ElectronContext folder to UserDataContext whenever it changes
    useEffect(() => {
        if (electronFolder) {
            setSelectedFolder(electronFolder);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [electronFolder]);

    const handleSelectFolder = async () =>
    {
        setLoading(true);
        setError('');
        setSuccess('');

        const result = await selectFolder();
        if (result)
        {
            setSuccess('Folder selected successfully');
        } else
        {
            setError('Failed to select folder');
        }

        setLoading(false);
    };

    const handleViewUserInput = async () =>
    {
        if (!electronFolder)
        {
            setError('Please select a project folder first');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        // Auto-load proll.ctl from the selected folder
        const ctlPath = `${electronFolder}/proll.ctl`;
        const loaded = await loadControlFile(ctlPath);

        setLoading(false);

        if (!loaded)
        {
            setError('proll.ctl not found in the selected folder. Please select the correct project folder.');
            return;
        }

        navigate('/project', { state: { activeTab: 'project' } });
    };

    const handleTabClick = (tab: string) =>
    {
        if (tab === 'input')
        {
            handleViewUserInput();
        } else
        {
            setActiveTab(tab);
        }
    };

    return (
        <div className="home-container">
            <div className="home-content">
                {/* Main Title */}
                <div className="title-section">
                    <h1 className="main-title">
                        Welcome to <img src={absLogo} alt="ABS Logo" className="abs-logo-img" /> | PRoll Diagram App
                    </h1>
                </div>

                {/* Project Card */}
                <div className="project-card">
                    {/* Tabs */}
                    <div className="card-tabs">
                        <button
                            className={`tab ${activeTab === 'project' ? 'active' : ''}`}
                            onClick={() => handleTabClick('project')}
                        >
                            Project
                        </button>
                        <button
                            className={`tab ${activeTab === 'input' ? 'active' : ''}`}
                            onClick={() => handleTabClick('input')}
                        >
                            User Data Input
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'project' && (
                        <div className="card-body">
                            <h3 className="section-title">Load Project File</h3>

                            {/* Folder Selection */}
                            <div className="file-row">
                                <div className="file-item">
                                    <span className="folder-icon">📁</span>
                                    <span className="file-name">
                                        {electronFolder || 'Select project folder'}
                                    </span>
                                </div>
                                <button
                                    className="select-btn"
                                    onClick={handleSelectFolder}
                                    disabled={loading}
                                >
                                    {loading ? 'Loading...' : 'Select Folder'}
                                </button>
                            </div>

                            {/* Status Messages */}
                            {error && (
                                <div className="status-message error">
                                    <span className="status-text">{error}</span>
                                </div>
                            )}
                            {success && (
                                <div className="status-message success">
                                    <span className="status-text">{success}</span>
                                    <span className="status-icon">✓</span>
                                </div>
                            )}

                            {/* View User Data Input Button */}
                            <div className="button-footer">
                                <button
                                    className="view-input-btn"
                                    onClick={handleViewUserInput}
                                    disabled={!electronFolder}
                                >
                                    View User Data Input
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;
