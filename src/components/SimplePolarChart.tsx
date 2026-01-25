import React, { useEffect, useRef } from 'react';

interface SimplePolarChartProps {
    rollMatrix: number[][] | null;
    speeds: number[] | null;
    headings: number[] | null;
    vesselHeading: number;
    maxRollAngle: number;
    width?: number;
    height?: number;
    mode?: 'continuous' | 'traffic-light';
    orientation?: 'north-up' | 'heads-up';
}

// Continuous color gradient matching the wireframe: Dark Blue -> Light Blue -> Cyan -> Green -> Yellow -> Orange -> Red -> Dark Red
function getContinuousColor(value: number, min: number, max: number): string {
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    // More vibrant colors matching wireframe exactly
    if (normalized < 0.14) {
        // Deep Blue to Medium Blue
        const t = normalized / 0.14;
        return `rgb(${Math.round(30 + t * 20)}, ${Math.round(60 + t * 140)}, ${Math.round(200 + t * 55)})`;
    } else if (normalized < 0.28) {
        // Medium Blue to Light Blue
        const t = (normalized - 0.14) / 0.14;
        return `rgb(${Math.round(50 + t * 50)}, ${Math.round(200 + t * 55)}, 255)`;
    } else if (normalized < 0.42) {
        // Light Blue to Cyan/Turquoise
        const t = (normalized - 0.28) / 0.14;
        return `rgb(${Math.round(100 + t * 64)}, 255, ${Math.round(255 - t * 64)})`;
    } else if (normalized < 0.56) {
        // Cyan to Greenish-Yellow
        const t = (normalized - 0.42) / 0.14;
        return `rgb(${Math.round(164 + t * 91)}, 255, ${Math.round(191 - t * 191)})`;
    } else if (normalized < 0.7) {
        // Yellow
        const t = (normalized - 0.56) / 0.14;
        return `rgb(255, ${Math.round(255 - t * 50)}, 0)`;
    } else if (normalized < 0.84) {
        // Yellow-Orange to Orange
        const t = (normalized - 0.7) / 0.14;
        return `rgb(255, ${Math.round(205 - t * 80)}, 0)`;
    } else {
        // Orange-Red to Deep Red
        const t = (normalized - 0.84) / 0.16;
        return `rgb(${Math.round(255 - t * 60)}, ${Math.round(125 - t * 75)}, ${Math.round(0 + t * 60)})`;
    }
}

// Traffic light colors
function getTrafficLightColor(value: number, maxRollAngle: number): string {
    if (value <= maxRollAngle - 5) {
        return '#00dd00'; // Green
    } else if (value <= maxRollAngle) {
        return '#ffdd00'; // Yellow
    } else {
        return '#ff0055'; // Red/Pink
    }
}

export const SimplePolarChart: React.FC<SimplePolarChartProps> = ({
    rollMatrix,
    speeds,
    headings,
    vesselHeading,
    maxRollAngle,
    width = 650,
    height = 650,
    mode = 'continuous',
    orientation = 'north-up'
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !rollMatrix || !speeds || !headings) {
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set high quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear background - DARK GRAY like wireframe
        ctx.fillStyle = '#5a6c7d';
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2 - 90;

        // Calculate data range
        let minRoll = Infinity;
        let maxRoll = -Infinity;

        for (let i = 0; i < rollMatrix.length; i++) {
            for (let j = 0; j < rollMatrix[i].length; j++) {
                const val = rollMatrix[i][j];
                if (isFinite(val) && val >= 0 && val <= 90) {
                    minRoll = Math.min(minRoll, val);
                    maxRoll = Math.max(maxRoll, val);
                }
            }
        }

        if (!isFinite(minRoll) || !isFinite(maxRoll)) {
            minRoll = 0;
            maxRoll = 30;
        }

        if (maxRoll <= minRoll) {
            maxRoll = minRoll + 10;
        }

        const maxSpeed = Math.max(...speeds);

        // ===== DRAW FILLED CONTOURS (CRITICAL: MUST STAY INSIDE CIRCLE) =====
        ctx.save();
        // Clip to circle to ensure NOTHING goes outside
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.clip();

        // Draw radial segments
        for (let speedIdx = 0; speedIdx < speeds.length; speedIdx++) {
            const speed = speeds[speedIdx];
            const r = (maxRadius * speed) / maxSpeed;
            
            // Get next radius for segment
            const nextSpeedIdx = Math.min(speedIdx + 1, speeds.length - 1);
            const nextSpeed = speeds[nextSpeedIdx];
            const rNext = (maxRadius * nextSpeed) / maxSpeed;

            for (let headingIdx = 0; headingIdx < headings.length; headingIdx++) {
                const heading = headings[headingIdx];
                const nextHeadingIdx = (headingIdx + 1) % headings.length;
                const nextHeading = headings[nextHeadingIdx];

                // Apply orientation
                let h1 = heading;
                let h2 = nextHeading;
                
                if (orientation === 'heads-up') {
                    h1 = (heading - vesselHeading + 360) % 360;
                    h2 = (nextHeading - vesselHeading + 360) % 360;
                }

                // Handle wrapping
                if (h2 < h1) {
                    h2 += 360;
                }

                // Convert to radians (0° = North = top)
                const angle1 = (h1 - 90) * Math.PI / 180;
                const angle2 = (h2 - 90) * Math.PI / 180;

                // Get roll value
                const roll = rollMatrix[speedIdx]?.[headingIdx];
                if (!isFinite(roll)) continue;

                // Choose color
                const color = mode === 'traffic-light'
                    ? getTrafficLightColor(roll, maxRollAngle)
                    : getContinuousColor(roll, minRoll, maxRoll);

                // Draw segment as filled arc wedge
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, r, angle1, angle2, false);
                ctx.lineTo(centerX, centerY);
                ctx.closePath();
                ctx.fill();

                // Draw outer ring segment if not last speed
                if (speedIdx < speeds.length - 1) {
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, r, angle1, angle2, false);
                    ctx.arc(centerX, centerY, rNext, angle2, angle1, true);
                    ctx.closePath();
                    ctx.fill();
                }

                // Subtle borders
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }

        ctx.restore(); // Remove clipping

        // ===== DRAW GRID LINES =====
        // Concentric circles
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;

        const speedSteps = [5, 10, 15, 20, 25];
        for (const step of speedSteps) {
            if (step > maxSpeed) continue;
            const r = (maxRadius * step) / maxSpeed;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
            ctx.stroke();

            // Label at top
            ctx.fillStyle = '#eee';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${step}kn`, centerX, centerY - r - 3);
        }

        // Radial lines (every 30°)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        for (let angle = 0; angle < 360; angle += 30) {
            const rad = (angle - 90) * Math.PI / 180;
            const x = centerX + maxRadius * Math.cos(rad);
            const y = centerY + maxRadius * Math.sin(rad);
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }

        // Degree labels
        ctx.fillStyle = '#ddd';
        ctx.font = '11px Arial';
        for (let angle = 0; angle < 360; angle += 30) {
            const rad = (angle - 90) * Math.PI / 180;
            const labelR = maxRadius + 18;
            const x = centerX + labelR * Math.cos(rad);
            const y = centerY + labelR * Math.sin(rad);
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${angle}°`, x, y);
        }

        // Compass labels
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        const compassR = maxRadius + 45;
        
        ctx.fillText('N', centerX, centerY - compassR);
        ctx.fillText('E', centerX + compassR, centerY);
        ctx.fillText('S', centerX, centerY + compassR);
        ctx.fillText('W', centerX - compassR, centerY);

        // Outer circle border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.stroke();

        // ===== VESSEL ICON =====
        drawVesselIcon(ctx, centerX, centerY, 18, orientation === 'heads-up' ? 0 : vesselHeading);

        // ===== WAVE DIRECTION ARROW =====
        const waveAngle = orientation === 'heads-up' ? -vesselHeading : 0;
        const waveRad = (waveAngle - 90) * Math.PI / 180;
        const waveLen = maxRadius * 0.55;
        const waveX = centerX + waveLen * Math.cos(waveRad);
        const waveY = centerY + waveLen * Math.sin(waveRad);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(waveX, waveY);
        ctx.stroke();

        // Arrow head
        const arrowSize = 12;
        const arrowAngle1 = waveRad - Math.PI / 6;
        const arrowAngle2 = waveRad + Math.PI / 6;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.moveTo(waveX, waveY);
        ctx.lineTo(waveX - arrowSize * Math.cos(arrowAngle1), waveY - arrowSize * Math.sin(arrowAngle1));
        ctx.lineTo(waveX - arrowSize * Math.cos(arrowAngle2), waveY - arrowSize * Math.sin(arrowAngle2));
        ctx.closePath();
        ctx.fill();

        // Wave label
        ctx.fillStyle = '#fff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Wave', waveX + 15, waveY - 6);
        ctx.fillText('Direction', waveX + 15, waveY + 6);

        // ===== COLOR SCALE LEGEND =====
        drawColorLegend(ctx, 25, 70, 22, 260, minRoll, maxRoll, mode, maxRollAngle);

    }, [rollMatrix, speeds, headings, vesselHeading, maxRollAngle, width, height, mode, orientation]);

    if (!rollMatrix || !speeds || !headings) {
        return (
            <div style={{ 
                width, 
                height, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#5a6c7d',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px'
            }}>
                <p>Loading polar data...</p>
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                border: '2px solid #3a4652',
                borderRadius: '8px',
                backgroundColor: '#5a6c7d',
                display: 'block',
            }}
        />
    );
};

// Draw vessel icon (triangle pointing in direction)
function drawVesselIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    heading: number
) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((heading - 90) * Math.PI) / 180);

    // White vessel body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(size, 0); // Point
    ctx.lineTo(-size * 0.5, size * 0.6);
    ctx.lineTo(-size * 0.5, -size * 0.6);
    ctx.closePath();
    ctx.fill();

    // Blue border
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Center blue dot (eye)
    ctx.fillStyle = '#2196f3';
    ctx.beginPath();
    ctx.arc(-size * 0.2, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Draw color scale legend
function drawColorLegend(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    minVal: number,
    maxVal: number,
    mode: 'continuous' | 'traffic-light',
    maxRollAngle: number
) {
    if (mode === 'continuous') {
        // Draw gradient from top (high) to bottom (low)
        for (let i = 0; i < height; i++) {
            const value = maxVal - (maxVal - minVal) * (i / height);
            ctx.fillStyle = getContinuousColor(value, minVal, maxVal);
            ctx.fillRect(x, y + i, width, 1);
        }
    } else {
        // Traffic light mode
        const redHeight = height * 0.25;
        const yellowHeight = height * 0.2;
        const greenHeight = height * 0.55;

        ctx.fillStyle = getTrafficLightColor(maxRollAngle + 5, maxRollAngle);
        ctx.fillRect(x, y, width, redHeight);

        ctx.fillStyle = getTrafficLightColor(maxRollAngle - 2, maxRollAngle);
        ctx.fillRect(x, y + redHeight, width, yellowHeight);

        ctx.fillStyle = getTrafficLightColor(0, maxRollAngle);
        ctx.fillRect(x, y + redHeight + yellowHeight, width, greenHeight);
    }

    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(maxVal.toFixed(1), x + width + 8, y - 2);
    
    ctx.textBaseline = 'bottom';
    ctx.fillText(minVal.toFixed(1), x + width + 8, y + height + 2);

    ctx.font = '10px Arial';
    ctx.fillStyle = '#ccc';
    ctx.textBaseline = 'top';
    ctx.fillText('Max roll', x + width + 8, y + height + 12);
    ctx.fillText('[deg]', x + width + 8, y + height + 25);
}