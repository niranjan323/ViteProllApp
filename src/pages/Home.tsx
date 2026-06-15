import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import absLogo from '../assets/ABS_Logo.png';
import { useElectron } from '../context/ElectronContext';
import { useUserData } from '../context/UserDataContext';
import { ApiFileSystemService } from '../services/apiFileService';

// When VITE_API_BASE_URL is empty we use WebFileSystemService (local folder picker)
// which behaves the same as Electron — no project dropdown needed.
const useLocalFolderPicker = !import.meta.env.VITE_API_BASE_URL;

const Home: React.FC = () => {
    const navigate = useNavigate();
    const {
        selectFolder,
        selectProject,
        loadControlFile,
        selectedFolder: electronFolder,
        isElectronMode,
    } = useElectron();
    const { setSelectedFolder } = useUserData();

    // Shared status
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Folder-picker mode (Electron OR local web dev)
    const [loading, setLoading] = useState(false);

    // Web-mode state (Azure project dropdown — only when VITE_API_BASE_URL is set)
    const [projects, setProjects] = useState<string[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');
    const [loadingProject, setLoadingProject] = useState(false);

    // Sync selected folder into UserDataContext
    useEffect(() => {
        if (electronFolder) setSelectedFolder(electronFolder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [electronFolder]);

    // Fetch project list from API on mount (web mode with Azure only)
    useEffect(() => {
        if (!isElectronMode && !useLocalFolderPicker) fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isElectronMode]);

    const fetchProjects = async () => {
        setLoadingProjects(true);
        setError('');
        try {
            const list = await ApiFileSystemService.listProjects();
            setProjects(list);
            if (list.length > 0) setSelectedProject(list[0]);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setLoadingProjects(false);
        }
    };

    // ── Web mode: load selected project ──────────────────────────────────────

    const handleLoadProject = async () => {
        if (!selectedProject) return;
        setLoadingProject(true);
        setError('');

        const result = await selectProject(selectedProject);
        setLoadingProject(false);

        if (!result.success) {
            setError(result.error ?? 'Failed to load project. Check that the control file exists.');
            return;
        }

        navigate('/project', { state: { activeTab: 'project' } });
    };

    // ── Electron mode handlers ────────────────────────────────────────────────

    const handleSelectFolder = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        const result = await selectFolder();
        setLoading(false);

        if (result) {
            setSuccess('Folder selected successfully');
        } else {
            setError('Failed to select folder');
        }
    };

    const handleEnterUserInput = async () => {
        if (!electronFolder) {
            setError('Please select a vessel data folder first');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        let ctlResult = await loadControlFile(`${electronFolder}/CRoll.ctl`);
        if (!ctlResult.success) {
            ctlResult = await loadControlFile(`${electronFolder}/croll.ctl`);
        }

        setLoading(false);

        if (!ctlResult.success) {
            setError('CRoll.ctl not found in the selected folder. Please select the correct project folder.');
            return;
        }

        navigate('/project', { state: { activeTab: 'project' } });
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="home-container">
            <div className="home-content">
                <div className="title-section">
                    <h1 className="main-title">
                        Welcome to <img src={absLogo} alt="ABS Logo" className="abs-logo-img" /> <span>| Eagle CRoll</span>
                    </h1>
                </div>

                <div className="project-card">
                    <div className="card-tabs">
                        <button className="tab active">Vessel Data</button>
                    </div>

                    <div className="card-body">
                        {(isElectronMode || useLocalFolderPicker) ? (
                            /* ── Desktop (Electron) or local web dev ────────────────── */
                            <>
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
                                        {loading ? 'Loading...' : 'Change Vessel Data Folder'}
                                    </button>
                                </div>

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

                                <div className="button-footer">
                                    <button
                                        className="view-input-btn"
                                        onClick={handleEnterUserInput}
                                        disabled={!electronFolder || loading}
                                    >
                                        Enter User Input
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* ── Web (browser) ──────────────────────────────────────── */
                            <>
                                {loadingProjects ? (
                                    <div className="web-loading">
                                        <div className="spinner" />
                                        <span>Loading projects...</span>
                                    </div>
                                ) : (
                                    <div className="web-project-select">
                                        <label className="web-label" htmlFor="project-dropdown">
                                            Select vessel project
                                        </label>
                                        {projects.length > 0 ? (
                                            <select
                                                id="project-dropdown"
                                                className="web-dropdown"
                                                value={selectedProject}
                                                onChange={e => {
                                                    setSelectedProject(e.target.value);
                                                    setError('');
                                                }}
                                                disabled={loadingProject}
                                            >
                                                {projects.map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            !error && (
                                                <p className="web-no-projects">
                                                    No projects found in storage.
                                                </p>
                                            )
                                        )}
                                    </div>
                                )}

                                {error && (
                                    <div className="status-message error">
                                        <span className="status-text">{error}</span>
                                    </div>
                                )}

                                {loadingProject && (
                                    <div className="web-loading">
                                        <div className="spinner" />
                                        <span>Loading project data...</span>
                                    </div>
                                )}

                                <div className="button-footer">
                                    <button
                                        className="view-input-btn"
                                        onClick={handleLoadProject}
                                        disabled={!selectedProject || loadingProjects || loadingProject}
                                    >
                                        {loadingProject ? 'Loading...' : 'Load Project'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
