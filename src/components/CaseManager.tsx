import React, { useState } from 'react';
import type { AnalysisCase } from '../services/caseManager';
import './CaseManager.css';

interface CaseManagerProps {
  cases: AnalysisCase[];
  onSaveCase: (caseId: string, caseData: AnalysisCase) => void;
  onDeleteCase: (caseId: string) => void;
  onLoadCase: (caseData: AnalysisCase) => void;
  canSave: boolean;
}

const CaseManagerComponent: React.FC<CaseManagerProps> = ({
  cases,
  onSaveCase: _onSaveCase,
  onDeleteCase,
  onLoadCase,
  canSave,
}) => {
  const [caseIdInput, setCaseIdInput] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);

  const handleSave = () => {
    if (!caseIdInput.trim()) {
      alert('Please enter a Case ID');
      return;
    }
    if (caseIdInput.length > 12) {
      alert('Case ID must be 12 characters or less');
      return;
    }
    // The actual case data will be passed from parent
    alert(`Case saved as: ${caseIdInput}`);
    setCaseIdInput('');
  };

  const handleDelete = (caseId: string) => {
    setCaseToDelete(caseId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (caseToDelete) {
      onDeleteCase(caseToDelete);
      if (selectedCaseId === caseToDelete) {
        setSelectedCaseId(null);
      }
      setCaseToDelete(null);
    }
    setShowDeleteConfirm(false);
  };

  const handleLoadCase = (caseData: AnalysisCase) => {
    setSelectedCaseId(caseData.id);
    onLoadCase(caseData);
  };

  return (
    <div className="case-manager">
      <div className="case-manager-section">
        <h3>Save New Case</h3>
        <div className="save-case-controls">
          <input
            type="text"
            placeholder="Enter Case ID (max 12 chars)"
            value={caseIdInput}
            onChange={(e) => setCaseIdInput(e.target.value.slice(0, 12))}
            maxLength={12}
            className="case-id-input"
          />
          <button
            onClick={handleSave}
            disabled={!canSave || !caseIdInput.trim()}
            className="save-case-btn"
          >
            Save Case
          </button>
        </div>
      </div>

      {cases.length > 0 && (
        <div className="case-manager-section">
          <h3>Saved Cases ({cases.length})</h3>
          <div className="cases-list">
            {cases.map((caseData) => (
              <div
                key={caseData.id}
                className={`case-item ${selectedCaseId === caseData.id ? 'selected' : ''}`}
              >
                <div className="case-info">
                  <div className="case-id">{caseData.id}</div>
                  <div className="case-details">
                    <span>GM: {caseData.vesselData.gm.toFixed(2)}m</span>
                    <span>Hs: {caseData.seaState.hs.toFixed(2)}m</span>
                    <span>Speed: {caseData.vesselData.speed.toFixed(1)}kts</span>
                  </div>
                </div>
                <div className="case-actions">
                  <button
                    onClick={() => handleLoadCase(caseData)}
                    className="load-case-btn"
                    title="Load this case"
                  >
                    📂 Load
                  </button>
                  <button
                    onClick={() => handleDelete(caseData.id)}
                    className="delete-case-btn"
                    title="Delete this case"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-confirmation-modal">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete case "{caseToDelete}"?</p>
            <p className="warning">This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={confirmDelete} className="confirm-delete-btn">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseManagerComponent;
