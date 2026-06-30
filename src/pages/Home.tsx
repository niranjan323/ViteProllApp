import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import absLogo from '../assets/ABS_Logo.png';
import { useElectron } from '../context/ElectronContext';
import { useUserData } from '../context/UserDataContext';
import { ApiFileSystemService } from '../services/apiFileService';

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

    // Electron-mode loading
    const [loading, setLoading] = useState(false);

    // Web-mode state
    const [showUpload, setShowUpload] = useState(false);
    const [projects, setProjects] = useState<string[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');
    const [loadingProject, setLoadingProject] = useState(false);

    // Upload state
    const [uploadProjectName, setUploadProjectName] = useState('');
    const [folderFiles, setFolderFiles] = useState<File[]>([]);
    const [controlFile, setControlFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploadError, setUploadError] = useState('');
    const folderInputRef = useRef<HTMLInputElement>(null);
    const ctlInputRef = useRef<HTMLInputElement>(null);

    // Sync selected folder into UserDataContext
    useEffect(() => {
        if (electronFolder) setSelectedFolder(electronFolder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [electronFolder]);

    // Fetch project list from API on mount (web mode only)
    useEffect(() => {
        if (!isElectronMode) fetchProjects();
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

    // ── Upload handlers ──────────────────────────────────────────────────────

    const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setFolderFiles(files);
        if (files.length > 0 && !uploadProjectName) {
            const topFolder = files[0].webkitRelativePath.split('/')[0];
            setUploadProjectName(topFolder);
        }
        setUploadStatus('');
        setUploadError('');
    };

    const handleCtlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setControlFile(file);
        setUploadStatus('');
        setUploadError('');
    };

    const folderHasCtl = folderFiles.some(f =>
        f.name.toLowerCase().endsWith('.ctl')
    );

    const handleUpload = async () => {
        if (!uploadProjectName.trim()) return;

        const allFiles: File[] = [];
        const allPaths: string[] = [];

        for (const file of folderFiles) {
            const parts = file.webkitRelativePath.split('/');
            const relativePath = parts.slice(1).join('/');
            allFiles.push(file);
            allPaths.push(relativePath);
        }

        if (controlFile && !folderHasCtl) {
            allFiles.push(controlFile);
            allPaths.push(controlFile.name);
        }

        if (allFiles.length === 0) return;

        setUploading(true);
        setUploadError('');
        setUploadStatus(`Uploading ${allFiles.length} files...`);

        try {
            await ApiFileSystemService.uploadFiles(uploadProjectName.trim(), allFiles, allPaths);
            setUploadStatus(`✓ Uploaded ${allFiles.length} files to project "${uploadProjectName.trim()}"`);
            fetchProjects();
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : String(err));
            setUploadStatus('');
        } finally {
            setUploading(false);
        }
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
                        {isElectronMode ? (
                            /* ── Desktop (Electron) ─────────────────────────────────── */
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
                                {/* Hidden file inputs */}
                                <input
                                    ref={folderInputRef}
                                    type="file"
                                    style={{ display: 'none' }}
                                    multiple
                                    // @ts-ignore — webkitdirectory is non-standard but works in all modern browsers
                                    webkitdirectory=""
                                    onChange={handleFolderChange}
                                />
                                <input
                                    ref={ctlInputRef}
                                    type="file"
                                    style={{ display: 'none' }}
                                    accept=".ctl"
                                    onChange={handleCtlChange}
                                />

                                {/* Project dropdown */}
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

                                {/* Upload toggle */}
                                <button
                                    className="upload-toggle"
                                    onClick={() => {
                                        setShowUpload(v => !v);
                                        setUploadError('');
                                        setUploadStatus('');
                                    }}
                                >
                                    <span className="upload-toggle-icon">{showUpload ? '▲' : '▼'}</span>
                                    {showUpload ? 'Hide upload' : '+ Upload new project'}
                                </button>

                                {/* Collapsible upload section */}
                                {showUpload && (
                                    <div className="upload-section">
                                        <div className="upload-field">
                                            <label className="web-label" htmlFor="upload-project-name">
                                                Project name
                                            </label>
                                            <input
                                                id="upload-project-name"
                                                type="text"
                                                className="web-input"
                                                placeholder="e.g. VesselName_2024"
                                                value={uploadProjectName}
                                                onChange={e => setUploadProjectName(e.target.value)}
                                            />
                                        </div>

                                        <div className="upload-pick-row">
                                            <button
                                                className="select-btn"
                                                onClick={() => folderInputRef.current?.click()}
                                                disabled={uploading}
                                            >
                                                📁 Select Folder
                                            </button>
                                            <span className="upload-pick-label">
                                                {folderFiles.length > 0
                                                    ? `${folderFiles[0].webkitRelativePath.split('/')[0]} (${folderFiles.length} files${folderHasCtl ? ', includes .ctl' : ''})`
                                                    : 'No folder selected'}
                                            </span>
                                        </div>

                                        {!folderHasCtl && (
                                            <div className="upload-pick-row">
                                                <button
                                                    className="select-btn"
                                                    onClick={() => ctlInputRef.current?.click()}
                                                    disabled={uploading}
                                                >
                                                    📄 Select Control File
                                                </button>
                                                <span className="upload-pick-label">
                                                    {controlFile ? controlFile.name : 'No .ctl file selected'}
                                                </span>
                                            </div>
                                        )}

                                        {uploadError && (
                                            <div className="status-message error">
                                                <span className="status-text">{uploadError}</span>
                                            </div>
                                        )}
                                        {uploadStatus && !uploadError && (
                                            <div className={`status-message${uploadStatus.startsWith('✓') ? ' success' : ''}`}>
                                                {uploading && <div className="spinner" />}
                                                <span className="status-text">{uploadStatus}</span>
                                            </div>
                                        )}

                                        <button
                                            className="upload-submit-btn"
                                            onClick={handleUpload}
                                            disabled={
                                                uploading ||
                                                !uploadProjectName.trim() ||
                                                (folderFiles.length === 0 && !controlFile)
                                            }
                                        >
                                            {uploading ? 'Uploading...' : 'Upload to Azure'}
                                        </button>
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
