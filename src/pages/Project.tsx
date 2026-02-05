import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './Project.css';
import { useUserData } from '../context/UserDataContext';
import { useElectron } from '../context/ElectronContext';
import { ParameterValidator } from '../services/parameterValidator';
import { CaseManager } from '../services/caseManager';
import type { AnalysisCase } from '../services/caseManager';
import { DataLoader } from '../services/dataLoader';
import { CanvasPolarChart } from '../components/CanvasPolarChart';

interface SavedCase {
    id: string;
    color: 'green' | 'pink';
    parameters: any;
}

// Wave period conversion factors
const WAVE_PERIOD_CONVERSIONS = {
    'tz': { factor: 1.0, label: 'Zero Up-crossing Wave Period, Tz (s)' },
    'tp-pm': { factor: 0.71, label: 'Peak Wave Period – Pierson-Moskowitz Spectrum, Tp (s)' },
    'tm-pm': { factor: 0.92, label: 'Mean Wave Period – Pierson-Moskowitz Spectrum, Tm (s)' },
    'tp-jonswap': { factor: 0.78, label: 'Peak Wave Period – JONSWAP Spectrum (mean), Tp (s)' },
    'tm-jonswap': { factor: 0.93, label: 'Mean Wave Period – JONSWAP Spectrum (mean), Tm (s)' }
};

const Project: React.FC = () => {
    const location = useLocation();
    const initialTab = (location.state as { activeTab?: string })?.activeTab || 'project';
    const { userInputData, updateVesselOperation, updateSeaState, setDraft } = useUserData();
    const { parameterBounds, representativeDrafts } = useElectron();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [caseId, setCaseId] = useState('');
    const [savedCases, setSavedCases] = useState<SavedCase[]>([]);
    const [draftType, setDraftType] = useState<'design' | 'intermediate' | 'scantling'>('design');
    const [caseManager] = useState(() => new CaseManager());
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const { fileSystem } = useElectron();
    const [dataLoader] = useState(() => new DataLoader(fileSystem));
    const [polarData, setPolarData] = useState<{
        rollMatrix: number[][] | null;
        speeds: number[] | null;
        headings: number[] | null;
    }>({ rollMatrix: null, speeds: null, headings: null });
    const [chartDirection, setChartDirection] = useState<'north-up' | 'heads-up'>('north-up');
    const [chartMode, setChartMode] = useState<'continuous' | 'traffic-light'>('continuous');
    const [wavePeriodType, setWavePeriodType] = useState<keyof typeof WAVE_PERIOD_CONVERSIONS>('tz');

    // Calculate displayed wave period value based on selected type
    const displayedWavePeriod = useMemo(() => {
        const factor = WAVE_PERIOD_CONVERSIONS[wavePeriodType].factor;
        return userInputData.seaState.wavePeriod / factor;
    }, [userInputData.seaState.wavePeriod, wavePeriodType]);

    // Calculate displayed range based on selected type
    const displayedWavePeriodRange = useMemo(() => {
        if (!parameterBounds) return null;
        const factor = WAVE_PERIOD_CONVERSIONS[wavePeriodType].factor;
        return {
            lower: parameterBounds.tzLower / factor,
            upper: parameterBounds.tzUpper / factor
        };
    }, [parameterBounds, wavePeriodType]);

    // Handle wave period input change with conversion
    const handleWavePeriodChange = (inputValue: number) => {
        const factor = WAVE_PERIOD_CONVERSIONS[wavePeriodType].factor;
        const tzValue = inputValue * factor; // Convert to Tz
        updateSeaState({ wavePeriod: tzValue });
    };

    // ... rest of your existing handlers (handleSaveCase, handleDeleteCase, handleLoadCase)
    const handleSaveCase = () => {
        if (!caseId.trim()) {
            alert('Please enter a case ID');
            return;
        }
        
        const caseIdToSave = caseId;
        
        const newCase: AnalysisCase = {
            id: caseIdToSave,
            timestamp: Date.now(),
            vesselData: {
                draftAft: userInputData.vesselOperation.draftAftPeak,
                draftFore: userInputData.vesselOperation.draftForePeak,
                gm: userInputData.vesselOperation.gm,
                heading: userInputData.vesselOperation.heading,
                speed: userInputData.vesselOperation.speed,
                maxRoll: userInputData.vesselOperation.maxAllowedRoll,
            },
            seaState: {
                hs: userInputData.seaState.significantWaveHeight,
                tz: userInputData.seaState.wavePeriod,
                waveDirection: userInputData.seaState.meanWaveDirection,
            },
            dataFilePath: '',
        };

        caseManager.addCase(caseIdToSave, newCase);
        const allCases = caseManager.getAllCases();
        setSavedCases(allCases.map((c, idx) => ({
            id: c.id,
            color: idx % 2 === 0 ? 'green' : 'pink',
            parameters: c,
        })));
        setCaseId('');
        alert(`Case "${caseIdToSave}" saved successfully`);
    };

    const handleDeleteCase = (id: string) => {
        caseManager.deleteCase(id);
        const allCases = caseManager.getAllCases();
        setSavedCases(allCases.map((c, idx) => ({
            id: c.id,
            color: idx % 2 === 0 ? 'green' : 'pink',
            parameters: c,
        })));
    };

    const handleLoadCase = (item: SavedCase) => {
        const caseData = item.parameters as AnalysisCase;
        updateVesselOperation({
            draftAftPeak: caseData.vesselData.draftAft,
            draftForePeak: caseData.vesselData.draftFore,
            gm: caseData.vesselData.gm,
            heading: caseData.vesselData.heading,
            speed: caseData.vesselData.speed,
            maxAllowedRoll: caseData.vesselData.maxRoll,
        });
        updateSeaState({
            significantWaveHeight: caseData.seaState.hs,
            wavePeriod: caseData.seaState.tz,
            meanWaveDirection: caseData.seaState.waveDirection,
        });
    };

    // Validate all parameters
    const validation = useMemo(() => {
        if (!parameterBounds) return null;
        return ParameterValidator.validateAll(
            userInputData.vesselOperation.draftAftPeak,
            userInputData.vesselOperation.draftForePeak,
            userInputData.vesselOperation.gm,
            userInputData.vesselOperation.heading,
            userInputData.vesselOperation.speed,
            userInputData.vesselOperation.maxAllowedRoll,
            userInputData.seaState.significantWaveHeight,
            userInputData.seaState.wavePeriod,
            userInputData.seaState.meanWaveDirection,
            parameterBounds
        );
    }, [userInputData, parameterBounds]);

    // Load polar data when parameters change
    useEffect(() => {
        const loadPolarData = async () => {
            if (!parameterBounds || !dataLoader) return;

            try {
                const findResult = await dataLoader.findDataFile({
                    draft: draftType,
                    gm: userInputData.vesselOperation.gm,
                    hs: userInputData.seaState.significantWaveHeight,
                    tz: userInputData.seaState.wavePeriod,
                });

                if (findResult.success && findResult.filePath) {
                    const dataResult = await dataLoader.loadPolarData(
                        findResult.filePath,
                        {
                            gm: userInputData.vesselOperation.gm,
                            hs: userInputData.seaState.significantWaveHeight,
                            tz: userInputData.seaState.wavePeriod,
                        }
                    );

                    if (dataResult.success && dataResult.data) {
                        setPolarData({
                            rollMatrix: dataResult.data.rollMatrix,
                            speeds: dataResult.data.speeds,
                            headings: dataResult.data.headings,
                        });
                    }
                }
            } catch (error) {
                console.error('Error loading polar data:', error);
            }
        };

        loadPolarData();
    }, [
        draftType,
        userInputData.vesselOperation.gm,
        userInputData.seaState.significantWaveHeight,
        userInputData.seaState.wavePeriod,
        parameterBounds,
        dataLoader,
    ]);

    const vesselConditions = [
        {
            label: 'Draft Aft Peak',
            value: userInputData.vesselOperation.draftAftPeak,
            unit: '[m]',
            range: 'value range [0-40 m]',
            onChange: (val: number) => updateVesselOperation({ draftAftPeak: val }),
            isInvalid: validation?.draftAft.outOfRange || false
        },
        {
            label: 'Draft Fore Peak',
            value: userInputData.vesselOperation.draftForePeak,
            unit: '[m]',
            range: 'value range [0-40 m]',
            onChange: (val: number) => updateVesselOperation({ draftForePeak: val }),
            isInvalid: validation?.draftFore.outOfRange || false
        },
        {
            label: 'GM',
            value: userInputData.vesselOperation.gm,
            unit: '[m]',
            range: parameterBounds ? `value range [${parameterBounds.gmLower.toFixed(1)}-${parameterBounds.gmUpper.toFixed(1)} m]` : '',
            onChange: (val: number) => updateVesselOperation({ gm: val }),
            isInvalid: validation?.gm.outOfRange || false
        },
        {
            label: 'Heading',
            value: userInputData.vesselOperation.heading,
            unit: '[degree]',
            range: '0 absolute from the North',
            onChange: (val: number) => updateVesselOperation({ heading: val }),
            isInvalid: validation?.heading.outOfRange || false
        },
        {
            label: 'Speed',
            value: userInputData.vesselOperation.speed,
            unit: '[kt]',
            range: 'value range [0-30 kt]',
            onChange: (val: number) => updateVesselOperation({ speed: val }),
            isInvalid: validation?.speed.outOfRange || false
        },
        {
            label: 'Max Allowed Roll',
            value: userInputData.vesselOperation.maxAllowedRoll,
            unit: '[degree]',
            range: 'value range [0-35 degree]',
            onChange: (val: number) => updateVesselOperation({ maxAllowedRoll: val }),
            isInvalid: validation?.maxRoll.outOfRange || false
        }
    ];

    const seaState = [
        {
            label: 'Mean Wave Direction',
            value: userInputData.seaState.meanWaveDirection,
            unit: '[degree]',
            range: '0 absolute from the North in incoming direction',
            onChange: (val: number) => updateSeaState({ meanWaveDirection: val }),
            isInvalid: validation?.waveDirection.outOfRange || false
        },
        {
            label: 'Significant Wave Height',
            value: userInputData.seaState.significantWaveHeight,
            unit: '[m]',
            range: parameterBounds ? `value range [${parameterBounds.hsLower.toFixed(1)}-${parameterBounds.hsUpper.toFixed(1)} m]` : '',
            onChange: (val: number) => updateSeaState({ significantWaveHeight: val }),
            isInvalid: validation?.hs.outOfRange || false
        }
    ];

    return (
        <div className="project-container">
            <div className="project-sidebar">
                <div className="project-tabs">
                    <button
                        className={`project-tab ${activeTab === 'project' ? 'active' : ''}`}
                        onClick={() => setActiveTab('project')}
                    >
                        Project
                    </button>
                    <button
                        className={`project-tab ${activeTab === 'input' ? 'active' : ''}`}
                        onClick={() => setActiveTab('input')}
                    >
                        User Data Input
                    </button>
                </div>

                <div className="sidebar-content">
                    {activeTab === 'input' && (
                        <>
                            <div className="section">
                                <h3 className="section-title">Draft Type</h3>
                                <div className="section-content">
                                    <select
                                        value={draftType}
                                        onChange={(e) => {
                                            setDraftType(e.target.value as 'design' | 'intermediate' | 'scantling');
                                            setDraft(e.target.value as 'design' | 'intermediate' | 'scantling');
                                        }}
                                        className="draft-select"
                                    >
                                        <option value="design">Design</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="scantling">Scantling</option>
                                    </select>
                                    {representativeDrafts && draftType in representativeDrafts && (
                                        <p className="draft-value">
                                            {representativeDrafts[draftType as keyof typeof representativeDrafts].toFixed(2)} m
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="section">
                                <h3 className="section-title">Vessel Operation Conditions</h3>
                                <div className="section-content">
                                    {vesselConditions.map((item, index) => (
                                        <div key={index} className="input-row-wrapper">
                                            <div className="input-row">
                                                <label className="input-label">{item.label}</label>
                                                <div className="input-group">
                                                    <span className={`indicator ${item.isInvalid ? 'invalid' : ''}`}>
                                                        {item.isInvalid ? '✗' : '✓'}
                                                    </span>
                                                    <div className="input-with-unit">
                                                        <input
                                                            type="number"
                                                            className={`input-field ${item.isInvalid ? 'invalid-input' : ''}`}
                                                            value={item.value}
                                                            onChange={(e) => item.onChange(parseFloat(e.target.value) || 0)}
                                                        />
                                                        <span className="input-unit">{item.unit}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="input-range">{item.range}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="section">
                                <h3 className="section-title">Sea State</h3>
                                <div className="section-content">
                                    {seaState.map((item, index) => (
                                        <div key={index} className="input-row-wrapper">
                                            <div className="input-row">
                                                <label className="input-label">{item.label}</label>
                                                <div className="input-group">
                                                    <span className={`indicator ${item.isInvalid ? 'invalid' : ''}`}>
                                                        {item.isInvalid ? '✗' : '✓'}
                                                    </span>
                                                    <div className="input-with-unit">
                                                        <input
                                                            type="number"
                                                            className={`input-field ${item.isInvalid ? 'invalid-input' : ''}`}
                                                            value={item.value}
                                                            onChange={(e) => item.onChange(parseFloat(e.target.value) || 0)}
                                                        />
                                                        <span className="input-unit">{item.unit}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {item.range && <div className="input-range">{item.range}</div>}
                                        </div>
                                    ))}
                                    
                                    {/* WAVE PERIOD WITH CONVERSION */}
                                    <div className="input-row-wrapper">
                                        <div className="input-row">
                                            <label className="input-label">Wave Period</label>
                                            <div className="input-group wave-period-group">
                                                <span className={`indicator ${validation?.tz.outOfRange ? 'invalid' : ''}`}>
                                                    {validation?.tz.outOfRange ? '✗' : '✓'}
                                                </span>
                                                <select 
                                                    className="wave-period-select"
                                                    value={wavePeriodType}
                                                    onChange={(e) => setWavePeriodType(e.target.value as keyof typeof WAVE_PERIOD_CONVERSIONS)}
                                                >
                                                    {Object.entries(WAVE_PERIOD_CONVERSIONS).map(([key, config]) => (
                                                        <option key={key} value={key}>{config.label}</option>
                                                    ))}
                                                </select>
                                                <div className="input-with-unit">
                                                    <input
                                                        type="number"
                                                        className={`input-field ${validation?.tz.outOfRange ? 'invalid-input' : ''}`}
                                                        value={displayedWavePeriod.toFixed(1)}
                                                        onChange={(e) => handleWavePeriodChange(parseFloat(e.target.value) || 0)}
                                                        step="0.1"
                                                    />
                                                    <span className="input-unit">[s]</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="input-range">
                                            {displayedWavePeriodRange ? 
                                                `value range [${displayedWavePeriodRange.lower.toFixed(1)}-${displayedWavePeriodRange.upper.toFixed(1)} s]` 
                                                : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="section">
                                <div className="section-header">
                                    <h3 className="section-title">Case Files</h3>
                                </div>
                                <div className="section-content">
                                    <div className="case-row">
                                        <label className="case-label">Save to case ID</label>
                                        <input
                                            type="text"
                                            className="case-input"
                                            value={caseId}
                                            onChange={(e) => setCaseId(e.target.value)}
                                            maxLength={12}
                                            placeholder="Max 12 chars"
                                        />
                                        <button className="save-btn" onClick={handleSaveCase}>💾</button>
                                    </div>
                                    <div className="case-row">
                                        <label className="case-label">Delete saved case</label>
                                        <select
                                            className="case-select"
                                            value={deleteConfirmId || ''}
                                            onChange={(e) => setDeleteConfirmId(e.target.value || null)}
                                        >
                                            <option value="">Select case to delete</option>
                                            {savedCases.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.id}
                                                </option>
                                            ))}
                                        </select>
                                        <button 
                                            className="delete-case-btn"
                                            onClick={() => {
                                                if (deleteConfirmId) {
                                                    handleDeleteCase(deleteConfirmId);
                                                    setDeleteConfirmId(null);
                                                }
                                            }}
                                            disabled={!deleteConfirmId}
                                        >
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'project' && (
                        <div className="section">
                            <h3 className="section-title">Project Information</h3>
                            <div className="section-content">
                                <p className="project-info">
                                    <strong>Selected Folder:</strong> {userInputData.selectedFolder || 'None'}
                                </p>
                                <p className="project-info">
                                    <strong>Control File:</strong> {userInputData.controlFile ? userInputData.controlFile.split('/').pop() : 'None'}
                                </p>
                                <p className="project-info">
                                    <strong>Draft Type:</strong> {draftType}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="project-main">
                <div className="plot-section">
                    <div className="plot-header">
                        <span className="plot-tab">Plot Area</span>
                    </div>
                    <div className="plot-canvas">
                        {polarData.rollMatrix && polarData.speeds && polarData.headings ? (
                            <>
                                <div className="plot-canvas-left">
                                    <CanvasPolarChart
                                        rollMatrix={polarData.rollMatrix}
                                        speeds={polarData.speeds}
                                        headings={polarData.headings}
                                        vesselHeading={userInputData.vesselOperation.heading}
                                        vesselSpeed={userInputData.vesselOperation.speed}
                                        maxRollAngle={userInputData.vesselOperation.maxAllowedRoll}
                                        meanWaveDirection={userInputData.seaState.meanWaveDirection}
                                        width={750}
                                        height={750}
                                        mode={chartMode}
                                        orientation={chartDirection}
                                    />
                                </div>
                                
                                <div className="plot-canvas-right">
                                    <div className="chart-options-panel">
                                        <div className="chart-options-section">
                                            <h4 className="options-header">Direction</h4>
                                            <div className="option-buttons">
                                                <label className="option-label">
                                                    <input 
                                                        type="radio"
                                                        name="direction"
                                                        value="north-up"
                                                        checked={chartDirection === 'north-up'}
                                                        onChange={(e) => setChartDirection(e.target.value as 'north-up' | 'heads-up')}
                                                    />
                                                    <span>North up</span>
                                                </label>
                                                <label className="option-label">
                                                    <input 
                                                        type="radio"
                                                        name="direction"
                                                        value="heads-up"
                                                        checked={chartDirection === 'heads-up'}
                                                        onChange={(e) => setChartDirection(e.target.value as 'north-up' | 'heads-up')}
                                                    />
                                                    <span>Heads up</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="chart-options-section">
                                            <h4 className="options-header">Mode</h4>
                                            <div className="option-buttons">
                                                <label className="option-label">
                                                    <input 
                                                        type="radio"
                                                        name="mode"
                                                        value="continuous"
                                                        checked={chartMode === 'continuous'}
                                                        onChange={(e) => setChartMode(e.target.value as 'continuous' | 'traffic-light')}
                                                    />
                                                    <span>Continuous</span>
                                                </label>
                                                <label className="option-label">
                                                    <input 
                                                        type="radio"
                                                        name="mode"
                                                        value="traffic-light"
                                                        checked={chartMode === 'traffic-light'}
                                                        onChange={(e) => setChartMode(e.target.value as 'continuous' | 'traffic-light')}
                                                    />
                                                    <span>Traffic light</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="chart-info-section">
                                            <p className="chart-info-text">Polar diagram closest to the user request</p>
                                            <div className="chart-params">
                                                <div className="param-row">
                                                    <label>Draft</label>
                                                    <input type="text" value={userInputData.vesselOperation.draftAftPeak} readOnly />
                                                </div>
                                                <div className="param-row">
                                                    <label>GM</label>
                                                    <input type="text" value={userInputData.vesselOperation.gm} readOnly />
                                                </div>
                                                <div className="param-row">
                                                    <label>Hs</label>
                                                    <input type="text" value={userInputData.seaState.significantWaveHeight} readOnly />
                                                </div>
                                                <div className="param-row">
                                                    <label>Tz</label>
                                                    <input type="text" value={userInputData.seaState.wavePeriod.toFixed(1)} readOnly />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="y-axis-container">
                                    <div className="y-axis-label">Roll [deg]</div>
                                    <div className="y-axis-scale">
                                        {[30, 25, 20, 15, 10, 5, 0].map(val => (
                                            <div key={val} className="scale-mark">{val}</div>
                                        ))}
                                    </div>
                                </div>

                                <div className="polar-chart-container">
                                    <div className="polar-chart">
                                        <div className="compass-label north">N</div>
                                        <div className="compass-label east">E</div>
                                        <div className="compass-label south">S</div>
                                        <div className="compass-label west">W</div>

                                        <div className="degree-label deg-30">30°</div>
                                        <div className="degree-label deg-60">60°</div>
                                        <div className="degree-label deg-120">120°</div>
                                        <div className="degree-label deg-150">150°</div>
                                        <div className="degree-label deg-210">210°</div>
                                        <div className="degree-label deg-240">240°</div>
                                        <div className="degree-label deg-300">300°</div>
                                        <div className="degree-label deg-330">330°</div>

                                        <div className="speed-label speed-25">25kn</div>
                                        <div className="speed-label speed-20">20kn</div>
                                        <div className="speed-label speed-15">15kn</div>
                                        <div className="speed-label speed-10">10kn</div>
                                        <div className="speed-label speed-5">5kn</div>
                                    </div>
                                </div>

                                <div className="max-roll-label">Max roll [deg]</div>
                            </>
                        )}
                    </div>
                </div>

                <div className="saved-cases-section">
                    <div className="saved-cases-header">
                        <span className="folder-icon">📁</span>
                        <h3 className="saved-cases-title">Saved Cases</h3>
                    </div>
                    <div className="saved-cases-content">
                        <button className="nav-arrow">‹</button>
                        <div className="saved-cases-list">
                            {savedCases.map((item) => (
                                <div key={item.id} className="case-tile-box" onClick={() => handleLoadCase(item)}>
                                    <div className={`case-tile-icon ${item.color}`}></div>
                                    <span className="case-tile-id">{item.id}</span>
                                </div>
                            ))}
                        </div>
                        <button className="nav-arrow">›</button>
                    </div>
                </div>

                <div className="footer-actions">
                    <div className="pdf-icon-box">
                        <span>PDF</span>
                    </div>
                    <button className="generate-report-btn">Generate Report</button>
                    <div className="report-options">
                        <label className="radio-label">
                            <input type="radio" name="report" value="current" defaultChecked />
                            <span className="radio-dot"></span>
                            <span>Current Case</span>
                        </label>
                        <label className="radio-label">
                            <input type="radio" name="report" value="all" />
                            <span className="radio-dot"></span>
                            <span>All Cases</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Project;