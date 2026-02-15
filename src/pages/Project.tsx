import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import './Project.css';
import { useUserData } from '../context/UserDataContext';
import { useElectron } from '../context/ElectronContext';
import { ParameterValidator } from '../services/parameterValidator';
import { CaseManager } from '../services/caseManager';
import type { AnalysisCase } from '../services/caseManager';
import { DataLoader } from '../services/dataLoader';
import { CanvasPolarChart } from '../components/CanvasPolarChart';
import type { CanvasPolarChartHandle } from '../components/CanvasPolarChart';
import { jsPDF } from 'jspdf';

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
    const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const { fileSystem } = useElectron();
    const [dataLoader] = useState(() => new DataLoader(fileSystem));
    const [polarData, setPolarData] = useState<{
        rollMatrix: number[][] | null;
        speeds: number[] | null;
        headings: number[] | null;
    }>({ rollMatrix: null, speeds: null, headings: null });
    const [chartDirection, setChartDirection] = useState<'north-up' | 'heads-up'>('north-up');
    const [chartMode, setChartMode] = useState<'continuous' | 'traffic-light'>('continuous');
    const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
    const [wavePeriodType, setWavePeriodType] = useState<keyof typeof WAVE_PERIOD_CONVERSIONS>('tz');

    // Report modal state
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportType, setReportType] = useState<'current' | 'all'>('current');
    const [showReportMenu, setShowReportMenu] = useState(false);
    const [selectedCaseForReport, setSelectedCaseForReport] = useState<SavedCase | null>(null);
    const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
    const chartRef = useRef<CanvasPolarChartHandle>(null);

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
    const showMessage = (text: string, type: 'success' | 'error') => {
        setSaveMessage({ text, type });
        setTimeout(() => setSaveMessage(null), 3000);
    };

    const handleSaveCase = () => {
        if (!caseId.trim()) {
            showMessage('Please enter a case ID', 'error');
            return;
        }

        const caseIdToSave = caseId.trim();

        if (caseManager.caseExists(caseIdToSave)) {
            showMessage(`Case "${caseIdToSave}" already exists. Use a different ID.`, 'error');
            return;
        }

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
        showMessage(`Case "${caseIdToSave}" saved`, 'success');
    };

    const handleDeleteCase = (id: string) => {
        const deleted = caseManager.deleteCase(id);
        if (deleted) {
            const allCases = caseManager.getAllCases();
            setSavedCases(allCases.map((c, idx) => ({
                id: c.id,
                color: idx % 2 === 0 ? 'green' : 'pink',
                parameters: c,
            })));
            showMessage(`Case "${id}" deleted`, 'success');
        }
    };

    const handleLoadCase = (item: SavedCase) => {
        const caseData = item.parameters as AnalysisCase;
        setActiveCaseId(item.id);
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

    // Get report data for a case (or current inputs if no case selected)
    const getReportData = useCallback((caseItem?: SavedCase) => {
        if (caseItem) {
            const c = caseItem.parameters as AnalysisCase;
            return {
                caseId: caseItem.id,
                draftAft: c.vesselData.draftAft,
                draftFore: c.vesselData.draftFore,
                gm: c.vesselData.gm,
                heading: c.vesselData.heading,
                speed: c.vesselData.speed,
                maxRoll: c.vesselData.maxRoll,
                waveDirection: c.seaState.waveDirection,
                hs: c.seaState.hs,
                tz: c.seaState.tz,
            };
        }
        return {
            caseId: caseId || 'Current',
            draftAft: userInputData.vesselOperation.draftAftPeak,
            draftFore: userInputData.vesselOperation.draftForePeak,
            gm: userInputData.vesselOperation.gm,
            heading: userInputData.vesselOperation.heading,
            speed: userInputData.vesselOperation.speed,
            maxRoll: userInputData.vesselOperation.maxAllowedRoll,
            waveDirection: userInputData.seaState.meanWaveDirection,
            hs: userInputData.seaState.significantWaveHeight,
            tz: userInputData.seaState.wavePeriod,
        };
    }, [caseId, userInputData]);

    const handleGenerateReport = () => {
        if (reportType === 'current') {
            // Use the actively selected case, or fall back to current inputs
            const activeCase = activeCaseId
                ? savedCases.find(c => c.id === activeCaseId) || null
                : null;
            setSelectedCaseForReport(activeCase);
        } else {
            setSelectedCaseForReport(null);
        }
        setShowReportModal(true);
        setShowReportMenu(false);
    };

    const handleDownloadPDF = useCallback((cases: ReturnType<typeof getReportData>[]) => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - margin * 2;

        cases.forEach((data, caseIndex) => {
            if (caseIndex > 0) doc.addPage();

            let y = 20;

            // Title
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(40, 40, 40);
            doc.text('Vessel Operation Conditions', margin, y);
            y += 12;

            // Case ID
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('Case ID', margin, y);
            doc.setTextColor(20, 115, 230);
            doc.setFont('helvetica', 'bold');
            doc.text(String(data.caseId), margin + 70, y);
            y += 10;

            // Table of parameters
            const rows = [
                ['Draft Aft Peak', String(data.draftAft), '[m]'],
                ['Draft Fore Peak', String(data.draftFore), '[m]'],
                ['Metacentric Height, GM', String(data.gm), '[m]'],
                ['Heading', String(data.heading), '[degree]'],
                ['Speed', String(data.speed), '[kn]'],
                ['Maximum Allowed Roll Angle', String(data.maxRoll), '[degree]'],
                ['Mean Wave Direction', String(data.waveDirection), '[degree]'],
                ['Significant Wave Height, Hs', String(data.hs), '[m]'],
                ['Mean Wave Period, Tz', String(data.tz), '[s]'],
            ];

            rows.forEach((row) => {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(60, 60, 60);
                doc.setFontSize(10);
                doc.text(row[0], margin, y);

                doc.setTextColor(20, 115, 230);
                doc.setFont('helvetica', 'bold');
                doc.text(row[1], margin + 70, y);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(row[2], margin + 90, y);
                y += 8;
            });

            y += 5;

            // Polar chart image
            const chartImage = chartRef.current?.getImageDataURL();
            if (chartImage) {
                const imgSize = Math.min(contentWidth, 140);
                const imgX = margin + (contentWidth - imgSize) / 2;
                doc.addImage(chartImage, 'PNG', imgX, y, imgSize, imgSize);
                y += imgSize + 10;
            }

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text('Polar diagram closest to the user request', margin, y);
            doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y + 5);
        });

        return doc;
    }, [getReportData]);

    const handleDownloadReport = useCallback(() => {
        let cases: ReturnType<typeof getReportData>[];
        if (reportType === 'all' && savedCases.length > 0) {
            cases = savedCases.map(c => getReportData(c));
        } else if (selectedCaseForReport) {
            cases = [getReportData(selectedCaseForReport)];
        } else {
            cases = [getReportData()];
        }

        const doc = handleDownloadPDF(cases);
        const caseLabel = reportType === 'all' ? 'all_cases' : (cases[0]?.caseId || 'report');
        doc.save(`polar_report_${caseLabel}.pdf`);
        setShowReportMenu(false);
    }, [reportType, savedCases, selectedCaseForReport, getReportData, handleDownloadPDF]);

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
        <div className="project-container" data-theme={colorMode}>
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
                                                <label className="input-label">
                                                    {item.label} <span className="input-unit-inline">{item.unit}</span>
                                                </label>
                                                <div className="input-group">
                                                    <span className={`indicator ${item.isInvalid ? 'invalid' : ''}`}>
                                                        {item.isInvalid ? '✗' : '✓'}
                                                    </span>
                                                    <div className="input-tooltip-wrapper">
                                                        <input
                                                            type="number"
                                                            className={`input-field-standalone ${item.isInvalid ? 'invalid-input' : ''}`}
                                                            value={item.value}
                                                            onChange={(e) => item.onChange(parseFloat(e.target.value) || 0)}
                                                        />
                                                        <span className="input-tooltip">{item.range}</span>
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
                                                <label className="input-label">
                                                    {item.label} <span className="input-unit-inline">{item.unit}</span>
                                                </label>
                                                <div className="input-group">
                                                    <span className={`indicator ${item.isInvalid ? 'invalid' : ''}`}>
                                                        {item.isInvalid ? '✗' : '✓'}
                                                    </span>
                                                    <div className="input-tooltip-wrapper">
                                                        <input
                                                            type="number"
                                                            className={`input-field-standalone ${item.isInvalid ? 'invalid-input' : ''}`}
                                                            value={item.value}
                                                            onChange={(e) => item.onChange(parseFloat(e.target.value) || 0)}
                                                        />
                                                        {item.range && <span className="input-tooltip">{item.range}</span>}
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
                                                <span className="input-unit-inline">[s]</span>
                                                <div className="input-tooltip-wrapper">
                                                    <input
                                                        type="number"
                                                        className={`input-field-standalone ${validation?.tz.outOfRange ? 'invalid-input' : ''}`}
                                                        value={displayedWavePeriod.toFixed(1)}
                                                        onChange={(e) => handleWavePeriodChange(parseFloat(e.target.value) || 0)}
                                                        step="0.1"
                                                    />
                                                    {displayedWavePeriodRange && (
                                                        <span className="input-tooltip">
                                                            {`value range [${displayedWavePeriodRange.lower.toFixed(1)}-${displayedWavePeriodRange.upper.toFixed(1)} s]`}
                                                        </span>
                                                    )}
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
                                    {saveMessage && (
                                        <div className={`save-message ${saveMessage.type}`}>
                                            {saveMessage.text}
                                        </div>
                                    )}
                                    <div className="case-row">
                                        <label className="case-label">Save to case ID</label>
                                        <input
                                            type="text"
                                            className="case-input"
                                            value={caseId}
                                            onChange={(e) => setCaseId(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCase(); }}
                                            maxLength={12}
                                            placeholder="Max 12 chars"
                                            autoComplete="off"
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
                                    {savedCases.length > 0 && (
                                        <div className="case-count">
                                            {savedCases.length} case{savedCases.length !== 1 ? 's' : ''} saved
                                        </div>
                                    )}
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
                                        ref={chartRef}
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
                                    {/* Chart Options Panel Container */}
                                    <div className="chart-right-panel">
                                        {/* Color Mode Heading */}
                                        <div className="color-mode-heading">Color Mode</div>
                                        {/* Color Mode Toggle */}
                                        <div className="color-mode-toggle">
                                            <span className="color-mode-icon">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                                    <line x1="8" y1="21" x2="16" y2="21"/>
                                                    <line x1="12" y1="17" x2="12" y2="21"/>
                                                </svg>
                                            </span>
                                            <label className="color-mode-option">
                                                <span>Light Mode</span>
                                                <input
                                                    type="radio"
                                                    name="colorMode"
                                                    value="light"
                                                    checked={colorMode === 'light'}
                                                    onChange={() => setColorMode('light')}
                                                    className="cm-radio"
                                                />
                                                <span className="cm-toggle"></span>
                                            </label>
                                            <label className="color-mode-option">
                                                <span>Dark Mode</span>
                                                <input
                                                    type="radio"
                                                    name="colorMode"
                                                    value="dark"
                                                    checked={colorMode === 'dark'}
                                                    onChange={() => setColorMode('dark')}
                                                    className="cm-radio"
                                                />
                                                <span className="cm-toggle"></span>
                                            </label>
                                        </div>

                                        {/* Direction & Mode Section */}
                                        <div className="direction-mode-box">
                                            {/* Direction Column */}
                                            <div className="direction-column">
                                                <div className="dm-header">Direction</div>
                                                <div className="dm-body">
                                                    <label className="dm-label">
                                                        <input
                                                            type="radio"
                                                            name="direction"
                                                            value="north-up"
                                                            checked={chartDirection === 'north-up'}
                                                            onChange={(e) => setChartDirection(e.target.value as 'north-up' | 'heads-up')}
                                                            className="dm-radio"
                                                        />
                                                        <span className="dm-radio-dot"></span>
                                                        North up
                                                    </label>
                                                    <label className="dm-label">
                                                        <input
                                                            type="radio"
                                                            name="direction"
                                                            value="heads-up"
                                                            checked={chartDirection === 'heads-up'}
                                                            onChange={(e) => setChartDirection(e.target.value as 'north-up' | 'heads-up')}
                                                            className="dm-radio"
                                                        />
                                                        <span className="dm-radio-dot"></span>
                                                        Heads up
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Mode Column */}
                                            <div className="mode-column">
                                                <div className="dm-header">Mode</div>
                                                <div className="dm-body">
                                                    <label className="dm-label">
                                                        <input
                                                            type="radio"
                                                            name="mode"
                                                            value="continuous"
                                                            checked={chartMode === 'continuous'}
                                                            onChange={(e) => setChartMode(e.target.value as 'continuous' | 'traffic-light')}
                                                            className="dm-radio"
                                                        />
                                                        <span className="dm-radio-dot"></span>
                                                        Continuous
                                                    </label>
                                                    <label className="dm-label">
                                                        <input
                                                            type="radio"
                                                            name="mode"
                                                            value="traffic-light"
                                                            checked={chartMode === 'traffic-light'}
                                                            onChange={(e) => setChartMode(e.target.value as 'continuous' | 'traffic-light')}
                                                            className="dm-radio"
                                                        />
                                                        <span className="dm-radio-dot"></span>
                                                        Traffic light
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Text */}
                                        <div className="chart-info-hint">
                                            Polar diagram closest to the user request
                                        </div>

                                        {/* Parameters Table */}
                                        <div className="params-table">
                                            {[
                                                { label: 'Draft', value: userInputData.vesselOperation.draftAftPeak, unit: '[m]' },
                                                { label: 'GM', value: userInputData.vesselOperation.gm, unit: '[m]' },
                                                { label: 'Hs', value: userInputData.seaState.significantWaveHeight, unit: '[m]' },
                                                { label: 'Tz', value: userInputData.seaState.wavePeriod, unit: '[s]' },
                                            ].map((row) => (
                                                <div key={row.label} className="params-row">
                                                    <label className="params-label">{row.label}</label>
                                                    <span className="params-unit">{row.unit}</span>
                                                    <input
                                                        readOnly
                                                        value={row.value}
                                                        className="params-input"
                                                    />
                                                </div>
                                            ))}
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
                                <div key={item.id} className={`case-tile-box ${activeCaseId === item.id ? 'active' : ''}`} onClick={() => handleLoadCase(item)}>
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
                    <button className="generate-report-btn" onClick={handleGenerateReport}>Generate Report</button>
                    <div className="report-options">
                        <label className="radio-label">
                            <input type="radio" name="report" value="current" checked={reportType === 'current'} onChange={() => setReportType('current')} />
                            <span className="radio-dot"></span>
                            <span>Current Case</span>
                        </label>
                        <label className="radio-label">
                            <input type="radio" name="report" value="all" checked={reportType === 'all'} onChange={() => setReportType('all')} />
                            <span className="radio-dot"></span>
                            <span>All Cases</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {showReportModal && (() => {
                const casesToShow = reportType === 'all' && savedCases.length > 0
                    ? savedCases.map(c => getReportData(c))
                    : selectedCaseForReport
                        ? [getReportData(selectedCaseForReport)]
                        : [getReportData()];

                return (
                    <div className="report-modal-overlay" onClick={() => { setShowReportModal(false); setShowReportMenu(false); }}>
                        <div className="report-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="report-modal-header">
                                <div className="report-modal-title">
                                    <div className="pdf-icon-box-small"><span>PDF</span></div>
                                    <span>Report</span>
                                </div>
                                <div className="report-modal-actions">
                                    <div className="report-menu-wrapper">
                                        <button className="report-menu-btn" onClick={() => setShowReportMenu(!showReportMenu)}>•••</button>
                                        {showReportMenu && (
                                            <div className="report-menu-dropdown">
                                                <button onClick={handleDownloadReport}>
                                                    📥 Download PDF
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button className="report-close-btn" onClick={() => { setShowReportModal(false); setShowReportMenu(false); }}>✕</button>
                                </div>
                            </div>
                            <div className="report-modal-body">
                                {casesToShow.map((data, idx) => (
                                    <div key={idx} className="report-case-section">
                                        <h3 className="report-section-title">Vessel Operation Conditions</h3>
                                        <div className="report-row">
                                            <span className="report-label">Case ID</span>
                                            <span className="report-value highlight">{data.caseId}</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Draft Aft Peak</span>
                                            <span className="report-value highlight">{data.draftAft}</span>
                                            <span className="report-unit">[m]</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Draft Fore Peak</span>
                                            <span className="report-value highlight">{data.draftFore}</span>
                                            <span className="report-unit">[m]</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Metacentric Height, GM</span>
                                            <span className="report-value highlight">{data.gm}</span>
                                            <span className="report-unit">[m]</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Heading</span>
                                            <span className="report-value highlight">{data.heading}</span>
                                            <span className="report-unit">[degree]</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Speed</span>
                                            <span className="report-value highlight">{data.speed}</span>
                                            <span className="report-unit">[kn]</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Maximum Allowed Roll Angle</span>
                                            <span className="report-value highlight">{data.maxRoll}</span>
                                            <span className="report-unit">[degree]</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Mean Wave Direction</span>
                                            <span className="report-value highlight">{data.waveDirection}</span>
                                            <span className="report-unit">[degree]</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Significant Wave Height, Hs</span>
                                            <span className="report-value highlight">{data.hs}</span>
                                            <span className="report-unit">[m]</span>
                                        </div>
                                        <div className="report-row">
                                            <span className="report-label">Mean Wave Period, Tz</span>
                                            <span className="report-value highlight">{data.tz}</span>
                                            <span className="report-unit">[s]</span>
                                        </div>

                                        <div className="report-chart-section">
                                            {polarData.rollMatrix && polarData.speeds && polarData.headings && (
                                                <CanvasPolarChart
                                                    rollMatrix={polarData.rollMatrix}
                                                    speeds={polarData.speeds}
                                                    headings={polarData.headings}
                                                    vesselHeading={data.heading}
                                                    vesselSpeed={data.speed}
                                                    maxRollAngle={data.maxRoll}
                                                    meanWaveDirection={data.waveDirection}
                                                    width={400}
                                                    height={400}
                                                    mode={chartMode}
                                                    orientation={chartDirection}
                                                />
                                            )}
                                        </div>
                                        <p className="report-chart-caption">Polar diagram closest to the user request</p>
                                        {idx < casesToShow.length - 1 && <hr className="report-divider" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default Project;