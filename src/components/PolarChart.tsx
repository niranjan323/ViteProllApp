import React, { useState } from 'react';
import { SimplePolarChart } from './SimplePolarChart';

// Test data generator - creates a distinctive pattern
function generateTestData() {
    const speeds = [0, 5, 10, 15, 20, 25];
    const headings = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
    
    // Create a distinctive pattern: high roll angles at specific headings
    const rollMatrix = speeds.map((speed, speedIdx) => {
        return headings.map((heading, headingIdx) => {
            // Create a pattern that's easy to verify:
            // - Low roll (0-10°) at 0° and 180° (head/following seas)
            // - High roll (20-30°) at 90° and 270° (beam seas)
            // - Medium roll (10-20°) at other angles
            
            const speedFactor = speedIdx / speeds.length;
            
            if (heading === 0 || heading === 180) {
                // Head/following seas - low roll
                return 5 + speedFactor * 10;
            } else if (heading === 90 || heading === 270) {
                // Beam seas - high roll
                return 20 + speedFactor * 15;
            } else if (heading === 30 || heading === 150 || heading === 210 || heading === 330) {
                // Quartering seas - medium-high roll
                return 15 + speedFactor * 10;
            } else {
                // Other angles - medium roll
                return 10 + speedFactor * 10;
            }
        });
    });
    
    return { speeds, headings, rollMatrix };
}

export const PolarChartTest: React.FC = () => {
    const { speeds, headings, rollMatrix } = generateTestData();
    
    const [vesselHeading, setVesselHeading] = useState(90);
    const [vesselSpeed, setVesselSpeed] = useState(12);
    const [maxRollAngle, setMaxRollAngle] = useState(20);
    const [mode, setMode] = useState<'continuous' | 'traffic-light'>('traffic-light');
    const [orientation, setOrientation] = useState<'north-up' | 'heads-up'>('north-up');
    
    return (
        <div style={{ 
            padding: '20px', 
            backgroundColor: '#f0f0f0',
            minHeight: '100vh',
            fontFamily: 'Arial, sans-serif'
        }}>
            <h1 style={{ marginBottom: '20px' }}>Polar Chart Test - Verify North Up vs Heads Up</h1>
            
            {/* Test Pattern Description */}
            <div style={{ 
                backgroundColor: '#fff', 
                padding: '15px', 
                borderRadius: '8px',
                marginBottom: '20px',
                border: '2px solid #2196f3'
            }}>
                <h3>Expected Pattern:</h3>
                <ul>
                    <li><strong style={{ color: '#00DD00' }}>GREEN zones</strong> (safe): at 0° and 180° (head/following seas)</li>
                    <li><strong style={{ color: '#DD0055' }}>RED zones</strong> (dangerous): at 90° and 270° (beam seas)</li>
                    <li><strong style={{ color: '#FFDD00' }}>YELLOW zones</strong>: at quartering angles (30°, 150°, 210°, 330°)</li>
                </ul>
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>
                    ⚠️ When switching to Heads Up mode, the SAME pattern should appear but ROTATED!
                </p>
            </div>
            
            {/* Controls */}
            <div style={{ 
                backgroundColor: '#fff', 
                padding: '20px', 
                borderRadius: '8px',
                marginBottom: '20px'
            }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '15px'
                }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Vessel Heading: {vesselHeading}°
                        </label>
                        <input 
                            type="range" 
                            min="0" 
                            max="360" 
                            step="10"
                            value={vesselHeading}
                            onChange={(e) => setVesselHeading(Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Vessel Speed: {vesselSpeed} kt
                        </label>
                        <input 
                            type="range" 
                            min="0" 
                            max="25" 
                            step="1"
                            value={vesselSpeed}
                            onChange={(e) => setVesselSpeed(Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Max Roll Angle: {maxRollAngle}°
                        </label>
                        <input 
                            type="range" 
                            min="10" 
                            max="35" 
                            step="1"
                            value={maxRollAngle}
                            onChange={(e) => setMaxRollAngle(Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
                
                <div style={{ marginTop: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Orientation:</label>
                        <label style={{ marginRight: '15px' }}>
                            <input 
                                type="radio" 
                                checked={orientation === 'north-up'}
                                onChange={() => setOrientation('north-up')}
                            /> North Up
                        </label>
                        <label>
                            <input 
                                type="radio" 
                                checked={orientation === 'heads-up'}
                                onChange={() => setOrientation('heads-up')}
                            /> Heads Up
                        </label>
                    </div>
                    
                    <div>
                        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Mode:</label>
                        <label style={{ marginRight: '15px' }}>
                            <input 
                                type="radio" 
                                checked={mode === 'continuous'}
                                onChange={() => setMode('continuous')}
                            /> Continuous
                        </label>
                        <label>
                            <input 
                                type="radio" 
                                checked={mode === 'traffic-light'}
                                onChange={() => setMode('traffic-light')}
                            /> Traffic Light
                        </label>
                    </div>
                </div>
            </div>
            
            {/* Test Instructions */}
            <div style={{ 
                backgroundColor: '#fffbcc', 
                padding: '15px', 
                borderRadius: '8px',
                marginBottom: '20px',
                border: '2px solid #ffc107'
            }}>
                <h3>How to Test:</h3>
                <ol>
                    <li><strong>Set Heading to 0°, North Up mode</strong>: You should see green at top/bottom, red at left/right</li>
                    <li><strong>Set Heading to 0°, Heads Up mode</strong>: Pattern should look IDENTICAL (vessel heading = 0°)</li>
                    <li><strong>Set Heading to 90°, North Up mode</strong>: Green at top/bottom, red at left/right (same as step 1)</li>
                    <li><strong>Set Heading to 90°, Heads Up mode</strong>: Pattern should ROTATE 90° CCW - green should now be at RIGHT/LEFT, red at TOP/BOTTOM</li>
                    <li><strong>Verify vessel icon</strong>: Should always point in correct direction</li>
                </ol>
            </div>
            
            {/* The Chart */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                backgroundColor: '#fff',
                padding: '20px',
                borderRadius: '8px'
            }}>
                <SimplePolarChart
                    rollMatrix={rollMatrix}
                    speeds={speeds}
                    headings={headings}
                    vesselHeading={vesselHeading}
                    vesselSpeed={vesselSpeed}
                    maxRollAngle={maxRollAngle}
                    mode={mode}
                    orientation={orientation}
                    width={650}
                    height={650}
                />
            </div>
            
            {/* Debug Info */}
            <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: '15px', 
                borderRadius: '8px',
                marginTop: '20px',
                fontFamily: 'monospace',
                fontSize: '12px'
            }}>
                <h4>Debug Info:</h4>
                <p>Orientation: {orientation}</p>
                <p>Mode: {mode}</p>
                <p>Vessel Heading: {vesselHeading}°</p>
                <p>Vessel Speed: {vesselSpeed} kt</p>
                <p>Max Roll: {maxRollAngle}°</p>
                <p>Data matrix size: {rollMatrix.length} speeds × {rollMatrix[0]?.length} headings</p>
            </div>
        </div>
    );
};

export default PolarChart;