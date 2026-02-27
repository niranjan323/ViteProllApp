import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import absLogo from '../assets/ABS_Logo.png';
import { useElectron } from '../context/ElectronContext';
import { useUserData } from '../context/UserDataContext';

const Home: React.FC = () =>
{
    const navigate = useNavigate();
    const { selectFolder, loadControlFile, selectedFolder: electronFolder, resetAll } = useElectron();
    const { setSelectedFolder, resetUserData } = useUserData();
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

    const handleEnterUserInput = async () =>
    {
        if (!electronFolder)
        {
            setError('Please select a vessel data folder first');
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

    const handleClearInput = () =>
    {
        resetAll();
        resetUserData();
        setError('');
        setSuccess('');
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

                {/* Vessel Data Card */}
                <div className="project-card">
                    {/* Single tab header */}
                    <div className="card-tabs">
                        <button className="tab active">
                            Vessel Data
                        </button>
                    </div>

                    <div className="card-body">
                        {/* Folder Selection */}
                        <div className="file-row">
                            <div className="file-item">
                                <span className="folder-icon">📁</span>
                                <span className="file-name">
                                    {electronFolder || 'Select vessel data folder'}
                                </span>
                            </div>
                            <button
                                className="select-btn"
                                onClick={handleSelectFolder}
                                disabled={loading}
                            >
                                {loading ? 'Loading...' : 'Select Vessel Data Folder'}
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

                        {/* Action Buttons */}
                        <div className="button-footer">
                            <button
                                className="view-input-btn"
                                onClick={handleEnterUserInput}
                                disabled={!electronFolder || loading}
                            >
                                Enter User Input
                            </button>
                            <button
                                className="clear-input-btn"
                                onClick={handleClearInput}
                            >
                                Clear Input
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
