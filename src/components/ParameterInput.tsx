import React from 'react';
import './ParameterInput.css';

interface ParameterInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  isOutOfRange?: boolean;
  unit: string;
}

const ParameterInput: React.FC<ParameterInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  isOutOfRange = false,
  unit,
}) => {
  return (
    <div className={`parameter-input ${isOutOfRange ? 'out-of-range' : ''}`}>
      <div className="parameter-header">
        <label>{label}</label>
        {isOutOfRange && <span className="error-indicator">✗</span>}
      </div>
      <div className="parameter-controls">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className={`input-field ${isOutOfRange ? 'invalid' : ''}`}
        />
        <span className="unit">{unit}</span>
      </div>
      <div className="parameter-range">
        Range: {min} - {max}
      </div>
    </div>
  );
};

export default ParameterInput;
