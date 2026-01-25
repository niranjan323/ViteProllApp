import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import absLogo from '../assets/ABS_Logo.png';
import { useElectron } from '../context/ElectronContext';
import { useUserData } from '../context/UserDataContext';

const Home: React.FC = () =>
{
    const navigate = useNavigate();
    const { selectFolder, selectControlFile, vesselInfo, selectedFolder: electronFolder, controlFilePath } = useElectron();
    const { userInputData, setSelectedFolder, setControlFile } = useUserData();
    const [ activeTab, setActiveTab ] = useState('project');
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState('');
    const [ success, setSuccess ] = useState('');

    const handleSelectFolder = async () =>
    {
        setLoading(true);
        setError('');
        setSuccess('');

        const result = await selectFolder();
        if (result && electronFolder)
        {
            setSelectedFolder(electronFolder);
            setSuccess('Folder selected successfully');
        } else
        {
            setError('Failed to select folder');
        }

        setLoading(false);
    };

    const handleSelectControlFile = async () =>
    {
        console.log('handleSelectControlFile called');
        console.log('window.electronAPI available:', !!window.electronAPI);
        
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const result = await selectControlFile();
            console.log('selectControlFile result:', result);
            
            if (result)
            {
                // Update both contexts - electron context already has it, now update user context
                if (controlFilePath) {
                    setControlFile(controlFilePath);
                    console.log('Updated UserDataContext with controlFile:', controlFilePath);
                }
                setSuccess('Control file loaded successfully');
            } else
            {
                setError('Failed to load control file');
            }
        } catch (err) {
            console.error('Error in handleSelectControlFile:', err);
            setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        setLoading(false);
    };

    const handleViewUserInput = () =>
    {
        console.log('handleViewUserInput - vesselInfo:', vesselInfo, 'controlFilePath:', controlFilePath);
        
        if (!controlFilePath)
        {
            setError('Please select a folder and load a control file first');
            return;
        }
        // Allow navigation if control file is loaded (vesselInfo might be Unknown but file is loaded)
        navigate('/project', { state: { activeTab: 'input' } });
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
                        Welcome to <img src={absLogo} alt="ABS Logo" className="abs-logo-img" /> | PROLL App
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

                            {/* Folder Item */}
                            <div className="file-row">
                                <div className="file-item">
                                    <span className="folder-icon">📁</span>
                                    <span className="file-name">
                                        {electronFolder || 'No folder selected'}
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

                            {/* File Item with Button */}
                            <div className="file-row">
                                <div className="file-item">
                                    <span className="file-icon">📄</span>
                                    <span className="file-name">
                                        {controlFilePath ? controlFilePath.split(/[\\/]/).pop() : 'No file selected'}
                                    </span>
                                </div>
                                <button
                                    className="load-control-btn"
                                    onClick={handleSelectControlFile}
                                    disabled={loading || !electronFolder}
                                >
                                    {loading ? 'Loading...' : 'Load Control File'}
                                </button>
                            </div>

                            {/* Vessel Info */}
                            {vesselInfo && (
                                <div className="vessel-info">
                                    <p><strong>Vessel Name:</strong> {vesselInfo.name}</p>
                                    <p><strong>IMO:</strong> {vesselInfo.imo}</p>
                                </div>
                            )}

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
                                    disabled={!vesselInfo || !userInputData.controlFile}
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
