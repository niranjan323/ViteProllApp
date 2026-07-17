import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import absLogo from '../assets/ABS_Logo.png';
import folderIcon from '../assets/folder.svg';
import deleteBlueIcon from '../assets/delete_solid_blue.svg';
import removeIcon from '../assets/remove.svg';
import { useElectron } from '../context/ElectronContext';
import { useUserData } from '../context/UserDataContext';
import { useUserEmail } from '../context/UserEmailContext';
import { ApiFileSystemService } from '../services/apiFileService';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const {
        selectFolder,
        selectProject,
        loadControlFile,
        selectedFolder: electronFolder,
        isElectronMode,
        fileSystem,
    } = useElectron();
    const { setSelectedFolder } = useUserData();
    const userId = useUserEmail();

    // Shared status
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [artWarning, setArtWarning] = useState('');

    // Electron-mode loading
    const [loading, setLoading] = useState(false);

    // Web-mode state
    const [showUpload, setShowUpload] = useState(false);
    const [projects, setProjects] = useState<{ name: string; isOwned: boolean }[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');
    const [loadingProject, setLoadingProject] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [deletingProject, setDeletingProject] = useState('');
    const [deleteConfirmProject, setDeleteConfirmProject] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Upload state
    const [uploadProjectName, setUploadProjectName] = useState('');
    const [folderFiles, setFolderFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploadError, setUploadError] = useState('');
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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
            const list = await ApiFileSystemService.listProjects(userId || undefined);
            setProjects(list);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setLoadingProjects(false);
        }
    };

    // ── Delete handlers ──────────────────────────────────────────────────────

    const handleDeleteProject = (projectName: string) => {
        setDeleteConfirmProject(projectName);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmProject) return;
        const name = deleteConfirmProject;
        setDeleteConfirmProject(null);
        setDeletingProject(name);
        setError('');
        try {
            await ApiFileSystemService.deleteProject(name, userId);
            if (selectedProject === name) setSelectedProject('');
            await fetchProjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setDeletingProject('');
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
            setError(result.error ?? 'Failed to load vessel data. Check that the control file exists.');
            return;
        }

        navigate('/project', { state: { activeTab: 'project', projectId: selectedProject } });
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

        // Warn if ART is installed in the control file but CRoll_ART data folder is missing
        if (ctlResult.artStatus === 1) {
            try {
                const entries = await fileSystem.listDirectory('');
                const hasNewFormat = entries.some((e: string) => e === 'CRoll' || e === 'CRoll_ART');
                if (hasNewFormat && !entries.some((e: string) => e === 'CRoll_ART')) {
                    setArtWarning('The control file indicates an Anti-Rolling Device is installed, but the CRoll_ART data folder is missing from the vessel data. ART mode will not be available.');
                    setLoading(false);
                    return;
                } else {
                    setArtWarning('');
                }
            } catch {
                setArtWarning('');
            }
        } else {
            setArtWarning('');
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

        if (allFiles.length === 0) return;

        setUploading(true);
        setUploadError('');
        setUploadStatus(`Uploading ${allFiles.length} files...`);

        try {
            await ApiFileSystemService.uploadFiles(uploadProjectName.trim(), allFiles, allPaths, userId || undefined);
            setUploadStatus(`✓ Uploaded ${allFiles.length} files to project "${uploadProjectName.trim()}". Reloading...`);
            // Reload the page so the dropdown refreshes with the newly uploaded vessel data.
            setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : String(err));
            setUploadStatus('');
            setUploading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="home-container">
            {/* ── Delete confirm modal ───────────────────────────────────── */}
            {deleteConfirmProject && (
                <div className="delete-modal-overlay" onClick={() => setDeleteConfirmProject(null)}>
                    <div className="delete-modal" onClick={e => e.stopPropagation()}>
                        <div className="delete-modal-header">
                            <span className="delete-modal-title">CRoll</span>
                            <button className="delete-modal-close" onClick={() => setDeleteConfirmProject(null)}>×</button>
                        </div>
                        <div className="delete-modal-body">
                            <img src={removeIcon} alt="" className="delete-modal-icon" />
                            <p className="delete-modal-text">Would you like to delete vessel data</p>
                        </div>
                        <div className="delete-modal-footer">
                            <button className="delete-modal-no" onClick={() => setDeleteConfirmProject(null)}>No</button>
                            <button className="delete-modal-yes" onClick={confirmDelete}>Yes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete confirm modal ───────────────────────────────────── */}
            {deleteConfirmProject && (
                <div className="delete-modal-overlay" onClick={() => setDeleteConfirmProject(null)}>
                    <div className="delete-modal" onClick={e => e.stopPropagation()}>
                        <div className="delete-modal-header">
                            <span className="delete-modal-title">CRoll</span>
                            <button className="delete-modal-close" onClick={() => setDeleteConfirmProject(null)}>×</button>
                        </div>
                        <div className="delete-modal-body">
                            <img src={removeIcon} alt="" className="delete-modal-icon" />
                            <p className="delete-modal-text">Would you like to delete vessel data</p>
                        </div>
                        <div className="delete-modal-footer">
                            <button className="delete-modal-no" onClick={() => setDeleteConfirmProject(null)}>No</button>
                            <button className="delete-modal-yes" onClick={confirmDelete}>Yes</button>
                        </div>
                    </div>
                </div>
            )}

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
                                        <img src={folderIcon} alt="" className="folder-icon-img" />
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
                                {artWarning && (
                                    <div className="status-message" style={{ background: '#fff8e1', border: '1px solid #ffe082', color: '#7a5c00', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', lineHeight: '1.5' }}>
                                        ⚠ {artWarning}
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
                                    // @ts-ignore
                                    webkitdirectory=""
                                    onChange={handleFolderChange}
                                />

                                {/* Project dropdown */}
                                {loadingProjects ? (
                                    <div className="web-loading">
                                        <div className="spinner" />
                                        <span>Loading vessel data...</span>
                                    </div>
                                ) : (
                                    <div className={`web-project-select${dropdownOpen ? ' open' : ''}${selectedProject ? ' has-value' : ''}`} ref={dropdownRef}>
                                        <label className="web-label">Select vessel data</label>

                                        {/* Dropdown header / trigger */}
                                        <div
                                            className={`project-dropdown-header${dropdownOpen ? ' open' : ''}`}
                                            onClick={() => { if (!loadingProject) setDropdownOpen(v => !v); }}
                                        >
                                            <span className={`project-dropdown-value${selectedProject ? '' : ' placeholder'}`}>
                                                {selectedProject || 'Vessel Data'}
                                            </span>
                                            <span className="project-dropdown-arrow" />
                                        </div>

                                        {/* Dropdown list */}
                                        {dropdownOpen && (
                                            projects.length > 0 ? (
                                                <div className="project-list">
                                                    {projects.map(p => (
                                                        <div
                                                            key={p.name}
                                                            className={`project-list-item${selectedProject === p.name ? ' selected' : ''}`}
                                                            onClick={() => {
                                                                setSelectedProject(p.name);
                                                                setError('');
                                                                setDropdownOpen(false);
                                                            }}
                                                        >
                                                            <span className="project-list-name">{p.name}</span>
                                                            <button
                                                                className={`project-delete-btn${deletingProject === p.name ? ' deleting' : ''}`}
                                                                title="Delete vessel data"
                                                                disabled={!!deletingProject || loadingProject}
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleDeleteProject(p.name);
                                                                }}
                                                            >
                                                                {deletingProject === p.name
                                                                    ? <span className="project-delete-spinner" />
                                                                    : <img src={deleteBlueIcon} alt="delete" width="14" height="16" />
                                                                }
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                !error && (
                                                    <div className="project-list">
                                                        <p className="web-no-projects">No vessel data found in storage.</p>
                                                    </div>
                                                )
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
                                    {showUpload ? 'Hide upload' : 'Upload vessel data'}
                                </button>

                                {/* Collapsible upload section */}
                                {showUpload && (
                                    <div className="upload-section">
                                        <div className="upload-field">
                                            <label className="upload-label" htmlFor="upload-project-name">
                                                Vessel data name
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
                                                <img src={folderIcon} alt="" className="btn-icon" />
                                                Select Folder
                                            </button>
                                            <span className="upload-pick-label">
                                                {folderFiles.length > 0
                                                    ? `${folderFiles[0].webkitRelativePath.split('/')[0]} (${folderFiles.length} files${folderHasCtl ? ', includes .ctl' : ''})`
                                                    : 'No folder selected'}
                                            </span>
                                        </div>

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
                                                folderFiles.length === 0
                                            }
                                        >
                                            {uploading ? 'Uploading...' : 'Upload'}
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
                                        <span>Loading vessel data...</span>
                                    </div>
                                )}

                                <div className="button-footer">
                                    <button
                                        className="view-input-btn"
                                        onClick={handleLoadProject}
                                        disabled={!selectedProject || loadingProjects || loadingProject}
                                    >
                                        {loadingProject ? 'Loading...' : 'Load Vessel Data'}
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