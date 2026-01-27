import React, { useEffect, useRef } from 'react';

interface SimplePolarChartProps {
    rollMatrix: number[][] | null;
    speeds: number[] | null;
    headings: number[] | null;
    vesselHeading: number;
    vesselSpeed: number;
    maxRollAngle: number;
    width?: number;
    height?: number;
    mode?: 'continuous' | 'traffic-light';
    orientation?: 'north-up' | 'heads-up';
}

function getContinuousColor(rollAngle: number, maxRollAngle: number): string {
    const normalized = Math.max(0, Math.min(1, rollAngle / maxRollAngle));
    
    if (normalized < 0.15) {
        const t = normalized / 0.15;
        return `rgb(${Math.round(0 + t * 20)}, ${Math.round(50 + t * 100)}, ${Math.round(140 + t * 95)})`;
    } else if (normalized < 0.3) {
        const t = (normalized - 0.15) / 0.15;
        return `rgb(${Math.round(20 + t * 0)}, ${Math.round(150 + t * 105)}, 235)`;
    } else if (normalized < 0.45) {
        const t = (normalized - 0.3) / 0.15;
        return `rgb(${Math.round(20 + t * 30)}, 255, ${Math.round(235 - t * 80)})`;
    } else if (normalized < 0.6) {
        const t = (normalized - 0.45) / 0.15;
        return `rgb(${Math.round(50 + t * 150)}, 255, ${Math.round(155 - t * 155)})`;
    } else if (normalized < 0.75) {
        const t = (normalized - 0.6) / 0.15;
        return `rgb(${Math.round(200 + t * 55)}, 255, 0)`;
    } else if (normalized < 0.9) {
        const t = (normalized - 0.75) / 0.15;
        return `rgb(255, ${Math.round(255 - t * 100)}, 0)`;
    } else {
        const t = (normalized - 0.9) / 0.1;
        return `rgb(255, ${Math.round(155 - t * 100)}, ${Math.round(0 + t * 50)})`;
    }
}

function getDangerColor(rollAngle: number, maxRollAngle: number): string {
    const excess = (rollAngle - maxRollAngle) / (maxRollAngle * 0.5);
    const t = Math.min(1, excess);
    return `rgb(${Math.round(255 - t * 50)}, ${Math.round(55 - t * 55)}, ${Math.round(50 + t * 50)})`;
}

function getTrafficLightColor(value: number, maxRollAngle: number): string {
    if (value <= maxRollAngle - 5) {
        return '#00DD00';
    } else if (value <= maxRollAngle) {
        return '#FFDD00';
    } else {
        return '#DD0055';
    }
}

function interpolateRoll(
    rollMatrix: number[][],
    speeds: number[],
    headings: number[],
    targetSpeed: number,
    targetHeading: number
): number {
    let speedIdx0 = 0;
    let speedIdx1 = 0;
    for (let i = 0; i < speeds.length - 1; i++) {
        if (speeds[i] <= targetSpeed && targetSpeed <= speeds[i + 1]) {
            speedIdx0 = i;
            speedIdx1 = i + 1;
            break;
        }
    }
    
    let headingIdx0 = 0;
    let headingIdx1 = 0;
    for (let i = 0; i < headings.length; i++) {
        const h1 = headings[i];
        const h2 = headings[(i + 1) % headings.length];
        if (h1 <= targetHeading && targetHeading <= h2) {
            headingIdx0 = i;
            headingIdx1 = (i + 1) % headings.length;
            break;
        }
    }
    
    const sT = speeds[speedIdx1] !== speeds[speedIdx0] 
        ? (targetSpeed - speeds[speedIdx0]) / (speeds[speedIdx1] - speeds[speedIdx0])
        : 0;
    const hT = headings[headingIdx1] !== headings[headingIdx0]
        ? (targetHeading - headings[headingIdx0]) / (headings[headingIdx1] - headings[headingIdx0])
        : 0;
    
    const r00 = rollMatrix[speedIdx0]?.[headingIdx0] || 0;
    const r01 = rollMatrix[speedIdx0]?.[headingIdx1] || 0;
    const r10 = rollMatrix[speedIdx1]?.[headingIdx0] || 0;
    const r11 = rollMatrix[speedIdx1]?.[headingIdx1] || 0;
    
    const r0 = r00 * (1 - hT) + r01 * hT;
    const r1 = r10 * (1 - hT) + r11 * hT;
    const roll = r0 * (1 - sT) + r1 * sT;
    
    return roll;
}

export const SimplePolarChart: React.FC<SimplePolarChartProps> = ({
    rollMatrix,
    speeds,
    headings,
    vesselHeading,
    vesselSpeed,
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

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.fillStyle = '#5a6c7d';
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2 - 90;
        const maxSpeed = Math.max(...speeds);

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.clip();

        const numSpeedSteps = 60;
        const numHeadingSteps = 180;

        for (let sIdx = 0; sIdx < numSpeedSteps - 1; sIdx++) {
            const speed1 = (sIdx / numSpeedSteps) * maxSpeed;
            const speed2 = ((sIdx + 1) / numSpeedSteps) * maxSpeed;
            const r1 = (maxRadius * speed1) / maxSpeed;
            const r2 = (maxRadius * speed2) / maxSpeed;

            for (let hIdx = 0; hIdx < numHeadingSteps; hIdx++) {
                const heading1 = (hIdx / numHeadingSteps) * 360;
                const heading2 = ((hIdx + 1) / numHeadingSteps) * 360;

                let h1 = heading1;
                let h2 = heading2;
                
                if (orientation === 'heads-up') {
                    h1 = (heading1 - vesselHeading + 360) % 360;
                    h2 = (heading2 - vesselHeading + 360) % 360;
                }

                const rollAngle = interpolateRoll(rollMatrix, speeds, headings, speed1, h1);
                
                if (!isFinite(rollAngle)) continue;

                let color: string;
                if (mode === 'traffic-light') {
                    color = getTrafficLightColor(rollAngle, maxRollAngle);
                } else {
                    if (rollAngle <= maxRollAngle) {
                        color = getContinuousColor(rollAngle, maxRollAngle);
                    } else {
                        color = getDangerColor(rollAngle, maxRollAngle);
                    }
                }

                const angle1 = (h1 - 90) * Math.PI / 180;
                const angle2 = (h2 - 90) * Math.PI / 180;

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(centerX, centerY, r1, angle1, angle2, false);
                ctx.arc(centerX, centerY, r2, angle2, angle1, true);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();

        // Grid circles
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;

        const speedSteps = [5, 10, 15, 20, 25];
        for (const step of speedSteps) {
            if (step > maxSpeed) continue;
            const r = (maxRadius * step) / maxSpeed;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#eee';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${step}kn`, centerX, centerY - r - 3);
        }

        // Radial lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
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

        // Compass
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Arial';
        const compassR = maxRadius + 45;
        
        ctx.fillText('N', centerX, centerY - compassR);
        ctx.fillText('E', centerX + compassR, centerY);
        ctx.fillText('S', centerX, centerY + compassR);
        ctx.fillText('W', centerX - compassR, centerY);

        // Outer circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Vessel icon - positioned based on speed and heading
        const vesselRadius = (maxRadius * vesselSpeed) / maxSpeed;
        
        let vesselX: number;
        let vesselY: number;
        
        if (orientation === 'heads-up') {
            vesselX = centerX;
            vesselY = centerY - vesselRadius;
        } else {
            const vesselAngleRad = ((vesselHeading - 90) * Math.PI / 180);
            vesselX = centerX + vesselRadius * Math.cos(vesselAngleRad);
            vesselY = centerY + vesselRadius * Math.sin(vesselAngleRad);
        }
        
        drawVesselIcon(ctx, vesselX, vesselY, 18, orientation === 'heads-up' ? 0 : vesselHeading);

        // Wave direction arrow - OUTSIDE the plot circle
        const waveAngle = orientation === 'heads-up' ? -vesselHeading : 0;
        const waveRad = (waveAngle - 90) * Math.PI / 180;
        const waveStartR = maxRadius + 10;
        const waveLen = 50;
        const waveStartX = centerX + waveStartR * Math.cos(waveRad);
        const waveStartY = centerY + waveStartR * Math.sin(waveRad);
        const waveEndX = centerX + (waveStartR + waveLen) * Math.cos(waveRad);
        const waveEndY = centerY + (waveStartR + waveLen) * Math.sin(waveRad);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(waveStartX, waveStartY);
        ctx.lineTo(waveEndX, waveEndY);
        ctx.stroke();

        // Arrow head
        const arrowSize = 12;
        const arrowAngle1 = waveRad - Math.PI / 6;
        const arrowAngle2 = waveRad + Math.PI / 6;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.moveTo(waveEndX, waveEndY);
        ctx.lineTo(waveEndX - arrowSize * Math.cos(arrowAngle1), waveEndY - arrowSize * Math.sin(arrowAngle1));
        ctx.lineTo(waveEndX - arrowSize * Math.cos(arrowAngle2), waveEndY - arrowSize * Math.sin(arrowAngle2));
        ctx.closePath();
        ctx.fill();

        // Wave label OUTSIDE
        ctx.fillStyle = '#fff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        const labelOffsetX = 15 * Math.cos(waveRad);
        const labelOffsetY = 15 * Math.sin(waveRad);
        ctx.fillText('Wave', waveEndX + labelOffsetX, waveEndY + labelOffsetY - 6);
        ctx.fillText('Direction', waveEndX + labelOffsetX, waveEndY + labelOffsetY + 6);

        // Color legend
        drawColorLegend(ctx, 25, 70, 22, 260, maxRollAngle, mode);

    }, [rollMatrix, speeds, headings, vesselHeading, vesselSpeed, maxRollAngle, width, height, mode, orientation]);

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

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.5, size * 0.6);
    ctx.lineTo(-size * 0.5, -size * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#2196f3';
    ctx.beginPath();
    ctx.arc(-size * 0.2, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawColorLegend(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    maxRollAngle: number,
    mode: 'continuous' | 'traffic-light'
) {
    if (mode === 'continuous') {
        for (let i = 0; i < height; i++) {
            const rollAngle = maxRollAngle * (1 - i / height);
            if (rollAngle <= maxRollAngle) {
                ctx.fillStyle = getContinuousColor(rollAngle, maxRollAngle);
            } else {
                ctx.fillStyle = getDangerColor(rollAngle, maxRollAngle);
            }
            ctx.fillRect(x, y + i, width, 1);
        }
    } else {
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

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(maxRollAngle.toFixed(1), x + width + 8, y - 2);
    
    ctx.textBaseline = 'bottom';
    ctx.fillText('0.0', x + width + 8, y + height + 2);

    ctx.font = '10px Arial';
    ctx.fillStyle = '#ccc';
    ctx.textBaseline = 'top';
    ctx.fillText('Max roll', x + width + 8, y + height + 12);
    ctx.fillText('[deg]', x + width + 8, y + height + 25);
}