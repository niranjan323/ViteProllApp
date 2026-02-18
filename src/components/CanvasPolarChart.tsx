import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

interface CanvasPolarChartProps {
    rollMatrix: number[][];
    speeds: number[];
    headings: number[];
    vesselHeading: number;
    vesselSpeed: number;
    maxRollAngle: number;
    meanWaveDirection: number;
    width?: number;
    height?: number;
    mode?: 'continuous' | 'traffic-light';
    orientation?: 'north-up' | 'heads-up';
}

export function normalizeAngle(angle: number): number {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
}

export function interpolateRoll(
    rollMatrix: number[][],
    speeds: number[],
    headings: number[],
    targetSpeed: number,
    targetHeading: number
): number {
    targetHeading = normalizeAngle(targetHeading);

    let speedIdx0 = 0;
    let speedIdx1 = 0;

    if (targetSpeed <= speeds[0]) {
        speedIdx0 = speedIdx1 = 0;
    } else if (targetSpeed >= speeds[speeds.length - 1]) {
        speedIdx0 = speedIdx1 = speeds.length - 1;
    } else {
        for (let i = 0; i < speeds.length - 1; i++) {
            if (speeds[i] <= targetSpeed && targetSpeed <= speeds[i + 1]) {
                speedIdx0 = i;
                speedIdx1 = i + 1;
                break;
            }
        }
    }

    let headingIdx0 = 0;
    let headingIdx1 = 0;
    let found = false;

    for (let i = 0; i < headings.length; i++) {
        const h1 = headings[i];
        const h2 = headings[(i + 1) % headings.length];

        if (h2 > h1) {
            if (h1 <= targetHeading && targetHeading <= h2) {
                headingIdx0 = i;
                headingIdx1 = (i + 1) % headings.length;
                found = true;
                break;
            }
        } else {
            // Wraps around 360 -> 0
            if (targetHeading >= h1 || targetHeading <= h2) {
                headingIdx0 = i;
                headingIdx1 = (i + 1) % headings.length;
                found = true;
                break;
            }
        }
    }

    if (!found) {
        let minDiff = 360;
        for (let i = 0; i < headings.length; i++) {
            const diff = Math.abs(targetHeading - headings[i]);
            const circularDiff = Math.min(diff, 360 - diff);
            if (circularDiff < minDiff) {
                minDiff = circularDiff;
                headingIdx0 = headingIdx1 = i;
            }
        }
    }

    // Speed interpolation weight
    const sT = speeds[speedIdx1] !== speeds[speedIdx0]
        ? (targetSpeed - speeds[speedIdx0]) / (speeds[speedIdx1] - speeds[speedIdx0])
        : 0;

    let hT = 0;
    if (headingIdx0 !== headingIdx1) {
        const h0 = headings[headingIdx0];
        const h1 = headings[headingIdx1];

        if (h1 > h0) {
            hT = (targetHeading - h0) / (h1 - h0);
        } else {
            const adjustedTarget = targetHeading < h0 ? targetHeading + 360 : targetHeading;
            const adjustedH1 = h1 + 360;
            hT = (adjustedTarget - h0) / (adjustedH1 - h0);
        }
    }

    // Bilinear interpolation
    const r00 = rollMatrix[speedIdx0]?.[headingIdx0] || 0;
    const r01 = rollMatrix[speedIdx0]?.[headingIdx1] || 0;
    const r10 = rollMatrix[speedIdx1]?.[headingIdx0] || 0;
    const r11 = rollMatrix[speedIdx1]?.[headingIdx1] || 0;

    const r0 = r00 * (1 - hT) + r01 * hT;
    const r1 = r10 * (1 - hT) + r11 * hT;
    return r0 * (1 - sT) + r1 * sT;
}

export interface CanvasPolarChartHandle {
    getImageDataURL: () => string | null;
}

export const CanvasPolarChart = forwardRef<CanvasPolarChartHandle, CanvasPolarChartProps>(({
    rollMatrix,
    speeds,
    headings,
    vesselHeading,
    vesselSpeed,
    maxRollAngle,
    meanWaveDirection,
    width = 750,
    height = 750,
    mode = 'continuous',
    orientation = 'north-up',
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
        getImageDataURL: () => {
            if (canvasRef.current) {
                return canvasRef.current.toDataURL('image/png');
            }
            return null;
        }
    }));

    // RdYlBu 10-class discrete colors (reversed: blue=low, red=high)
    const discreteColors: [number, number, number][] = [
        [49, 54, 149],    // Bin 1  - #313695 (lowest)
        [69, 117, 180],   // Bin 2  - #4575B4
        [116, 173, 209],  // Bin 3  - #74ADD1
        [171, 217, 233],  // Bin 4  - #ABD9E9
        [224, 243, 248],  // Bin 5  - #E0F3F8
        [254, 224, 144],  // Bin 6  - #FEE090
        [253, 174, 97],   // Bin 7  - #FDAE61
        [244, 109, 67],   // Bin 8  - #F46D43
        [215, 48, 39],    // Bin 9  - #D73027
        [165, 0, 38],     // Bin 10 - #A50026 (above MaxRoll)
    ];

    // 10-stage discrete color scale (per specification document)
    // Bins 1-9: MinRoll to MaxRoll at interval (MaxRoll - MinRoll) / 9
    // Bin 10: roll angles > MaxRoll
    const getContinuousColorRGB = (rollAngle: number, minRoll: number, maxRoll: number): [number, number, number] => {
        if (maxRoll <= minRoll) return discreteColors[0];
        if (rollAngle > maxRoll) return discreteColors[9];
        if (rollAngle <= minRoll) return discreteColors[0];

        const interval = (maxRoll - minRoll) / 9;
        const binIndex = Math.min(Math.floor((rollAngle - minRoll) / interval), 8);
        return discreteColors[binIndex];
    };

    // 3-stage discrete traffic light (per specification document)
    // Green: 0 to (MaxRoll - 5°), Yellow: (MaxRoll - 5°) to MaxRoll, Red: > MaxRoll
    const getTrafficLightColorRGB = (value: number, maxRoll: number): [number, number, number] => {
        if (value <= maxRoll - 5) {
            return [9, 190, 94];     // Green #09BE5E
        } else if (value <= maxRoll) {
            return [255, 236, 116];  // Yellow #FFEC74
        } else {
            return [247, 17, 106];   // Red #F7116A
        }
    };

    // Helper to draw text with dark outline for readability on any background
    const drawTextWithOutline = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Transparent background
        ctx.clearRect(0, 0, width, height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';


        const legendTotalWidth = 80;
        const centerX = legendTotalWidth + (width - legendTotalWidth) / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width - legendTotalWidth - 60, height - 80) * 0.42;

        // Fixed speed range: 0-25 kn as per specification
        const maxSpeed = 25;

        // Compute MinRoll from data (per specification)
        let minRoll = Infinity;
        for (let si = 0; si < rollMatrix.length; si++) {
            for (let hi = 0; hi < (rollMatrix[si]?.length || 0); hi++) {
                const v = rollMatrix[si][hi];
                if (isFinite(v) && v >= 0 && v <= 90) {
                    minRoll = Math.min(minRoll, v);
                }
            }
        }
        if (!isFinite(minRoll) || minRoll >= maxRollAngle) {
            minRoll = 0;
        }

        // Scale legend to include all bins
        const binInterval = maxRollAngle > minRoll ? (maxRollAngle - minRoll) / 9 : 1;
        const colorScaleMax = mode === 'continuous'
            ? maxRollAngle + binInterval
            : maxRollAngle + 10;

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 0;
        }

        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                const dx = px - centerX;
                const dy = py - centerY;
                const radius = Math.sqrt(dx * dx + dy * dy);

                if (radius <= maxRadius) {
                  
                    const atan2Deg = Math.atan2(dy, dx) * (180 / Math.PI);
                    const displayAngle = normalizeAngle(atan2Deg + 90);

             
                    const compassHeading = orientation === 'heads-up'
                        ? normalizeAngle(displayAngle + vesselHeading)
                        : displayAngle;
                    let encounterAngle = normalizeAngle(meanWaveDirection - compassHeading);
                    if (encounterAngle > 180) {
                        encounterAngle = 360 - encounterAngle;
                    }

                    const speed = (radius / maxRadius) * maxSpeed;

                    const rollValue = interpolateRoll(rollMatrix, speeds, headings, speed, encounterAngle);

                    const [r, g, b] = mode === 'continuous'
                        ? getContinuousColorRGB(rollValue, minRoll, maxRollAngle)
                        : getTrafficLightColorRGB(rollValue, maxRollAngle);

                    const idx = (py * width + px) * 4;
                    data[idx] = Math.round(r);
                    data[idx + 1] = Math.round(g);
                    data[idx + 2] = Math.round(b);
                    data[idx + 3] = 255;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.30)';
        ctx.lineWidth = 0.5;
        for (let spd = 1; spd <= maxSpeed; spd++) {
            // Skip major circles (5, 10, 15, 20, 25)
            if (spd % 5 === 0) continue;
            const r = (spd / maxSpeed) * maxRadius;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = 1.5;
        for (let i = 1; i <= 5; i++) {
            const r = (maxRadius / 5) * i;
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
            ctx.stroke();
        }

        for (let angle = 0; angle < 360; angle += 30) {
            let displayAngle = angle;
            if (orientation === 'heads-up') {
                displayAngle = angle - vesselHeading;
            }
            const rad = (displayAngle - 90) * (Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + maxRadius * Math.cos(rad),
                centerY + maxRadius * Math.sin(rad)
            );
            ctx.stroke();
        }


        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const speedStep = 5;
        const maxSpeedLabel = Math.ceil(maxSpeed / speedStep) * speedStep;
        for (let spd = speedStep; spd <= maxSpeedLabel; spd += speedStep) {
            const r = (spd / maxSpeed) * maxRadius;
            if (r <= maxRadius) {
                drawTextWithOutline(ctx, `${spd}kn`, centerX + 3, centerY - r - 4);
            }
        }


        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial, sans-serif';

        const compassLabels = [
            { angle: 0, label: 'N' },
            { angle: 90, label: 'E' },
            { angle: 180, label: 'S' },
            { angle: 270, label: 'W' },
        ];

        for (const { angle, label } of compassLabels) {
            let displayAngle = angle;
            if (orientation === 'heads-up') {
                displayAngle = angle - vesselHeading;
            }
            const rad = (displayAngle - 90) * (Math.PI / 180);
            const labelDist = maxRadius + 30;
            const lx = centerX + labelDist * Math.cos(rad);
            const ly = centerY + labelDist * Math.sin(rad);
            drawTextWithOutline(ctx, label, lx, ly);
        }

        // Intermediate angle labels
        ctx.font = '13px Arial, sans-serif';
        ctx.fillStyle = '#CCCCCC';
        const intermediateAngles = [30, 60, 120, 150, 210, 240, 300, 330];
        for (const angle of intermediateAngles) {
            let displayAngle = angle;
            if (orientation === 'heads-up') {
                displayAngle = angle - vesselHeading;
            }
            const rad = (displayAngle - 90) * (Math.PI / 180);
            const labelDist = maxRadius + 26;
            const lx = centerX + labelDist * Math.cos(rad);
            const ly = centerY + labelDist * Math.sin(rad);
            drawTextWithOutline(ctx, `${angle}\u00B0`, lx, ly);
        }


        let displayWaveAngle = meanWaveDirection;
        if (orientation === 'heads-up') {
            displayWaveAngle = (meanWaveDirection - vesselHeading + 360) % 360;
        }
        const waveRad = (displayWaveAngle - 90) * (Math.PI / 180);

        // Arrow from inner edge toward outer (label) area
        const waveInnerX = centerX + maxRadius * 0.88 * Math.cos(waveRad);
        const waveInnerY = centerY + maxRadius * 0.88 * Math.sin(waveRad);
        const waveOuterX = centerX + maxRadius * 1.20 * Math.cos(waveRad);
        const waveOuterY = centerY + maxRadius * 1.20 * Math.sin(waveRad);

        // Arrow shaft
        ctx.strokeStyle = '#CCCCCC';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(waveInnerX, waveInnerY);
        ctx.lineTo(waveOuterX, waveOuterY);
        ctx.stroke();

        // Arrow head at outer end, pointing outward
        const arrowSize = 12;
        ctx.fillStyle = '#CCCCCC';
        ctx.beginPath();
        ctx.moveTo(waveOuterX, waveOuterY);
        ctx.lineTo(
            waveOuterX - arrowSize * Math.cos(waveRad - Math.PI / 6),
            waveOuterY - arrowSize * Math.sin(waveRad - Math.PI / 6)
        );
        ctx.lineTo(
            waveOuterX - arrowSize * Math.cos(waveRad + Math.PI / 6),
            waveOuterY - arrowSize * Math.sin(waveRad + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();

        // "Wave Direction" label (white text)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const waveLabelDist = maxRadius * 1.35;
        const waveLabelX = centerX + waveLabelDist * Math.cos(waveRad);
        const waveLabelY = centerY + waveLabelDist * Math.sin(waveRad);
        ctx.save();
        ctx.translate(waveLabelX, waveLabelY);
        drawTextWithOutline(ctx, 'Wave', 0, -7);
        drawTextWithOutline(ctx, 'Direction', 0, 7);
        ctx.restore();

        // --- Vessel indicator (boat icon) ---
        const displayVesselAngle = orientation === 'heads-up' ? 0 : vesselHeading;
        const vesselRad = (displayVesselAngle - 90) * (Math.PI / 180);
        const vesselRadius = (vesselSpeed / maxSpeed) * maxRadius;
        const vesselX = centerX + vesselRadius * Math.cos(vesselRad);
        const vesselY = centerY + vesselRadius * Math.sin(vesselRad);

        ctx.save();
        ctx.translate(vesselX, vesselY);
        ctx.rotate(vesselRad + Math.PI / 2);

        // Vessel design matching wireframe - pointed bow shape with blue center dot
        const boatLength = 36;
        const boatWidth = 16;

        // White pointed vessel body (tapered bow, rounded stern)
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#012B4F';
        ctx.lineWidth = 2;

        ctx.beginPath();
        // Start at pointed bow (top)
        ctx.moveTo(0, -boatLength / 2);
        // Right side curve from bow to widest point
        ctx.quadraticCurveTo(boatWidth / 2, -boatLength / 4, boatWidth / 2, boatLength / 6);
        // Right side to stern
        ctx.quadraticCurveTo(boatWidth / 2, boatLength / 2.5, 0, boatLength / 2);
        // Left side from stern
        ctx.quadraticCurveTo(-boatWidth / 2, boatLength / 2.5, -boatWidth / 2, boatLength / 6);
        // Left side curve back to bow
        ctx.quadraticCurveTo(-boatWidth / 2, -boatLength / 4, 0, -boatLength / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Blue center dot only (matching wireframe)
        ctx.fillStyle = '#1473E6';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();

        // --- Color scale legend (left side) ---
        const legendBarX = 18;
        const legendBarWidth = 22;
        const legendBarTop = centerY - maxRadius + 20;
        const legendBarBottom = centerY + maxRadius - 20;
        const legendBarHeight = legendBarBottom - legendBarTop;

        // Title: "Roll [deg]" - WHITE text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Roll [deg]', 10, legendBarTop - 8);

        // "Max roll [deg]" rotated vertical label - WHITE
        ctx.save();
        ctx.translate(8, centerY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#CCCCCC';
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Max roll [deg]', 0, 0);
        ctx.restore();

        // Draw discrete color scale legend
        if (mode === 'continuous') {
            for (let i = 0; i <= legendBarHeight; i++) {
                const rollValue = (colorScaleMax * (legendBarHeight - i)) / legendBarHeight;
                const [r, g, b] = getContinuousColorRGB(rollValue, minRoll, maxRollAngle);
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(legendBarX, legendBarTop + i, legendBarWidth, 1);
            }
        } else {
            for (let i = 0; i <= legendBarHeight; i++) {
                const rollValue = (colorScaleMax * (legendBarHeight - i)) / legendBarHeight;
                const [r, g, b] = getTrafficLightColorRGB(rollValue, maxRollAngle);
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(legendBarX, legendBarTop + i, legendBarWidth, 1);
            }
        }

        // Legend border
        ctx.strokeStyle = '#AAAAAA';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendBarX, legendBarTop, legendBarWidth, legendBarHeight);

        // Legend labels and boundary lines (mode-specific)
        const maxLegendValue = Math.ceil(colorScaleMax);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        if (mode === 'continuous') {
            // Continuous mode: tick marks and labels at every 5° (no lines through bar)
            for (let deg = 0; deg <= maxLegendValue; deg += 5) {
                const yPos = legendBarBottom - (deg / colorScaleMax) * legendBarHeight;

                // Tick mark only (no line through bar)
                ctx.strokeStyle = '#AAAAAA';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(legendBarX + legendBarWidth, yPos);
                ctx.lineTo(legendBarX + legendBarWidth + 4, yPos);
                ctx.stroke();

                // Value label
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(`${deg}`, legendBarX + legendBarWidth + 6, yPos);
            }

            // "Max roll" indicator line on legend (continuous mode only)
            const maxRollYPos = legendBarBottom - (maxRollAngle / colorScaleMax) * legendBarHeight;
            ctx.strokeStyle = '#E4262B';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.beginPath();
            ctx.moveTo(legendBarX - 3, maxRollYPos);
            ctx.lineTo(legendBarX + legendBarWidth + 3, maxRollYPos);
            ctx.stroke();
            ctx.setLineDash([]);

            // Max roll label - RED
            ctx.fillStyle = '#FF6666';
            ctx.font = 'bold 10px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('Max', legendBarX + legendBarWidth + 6, maxRollYPos - 8);
            ctx.fillText('roll', legendBarX + legendBarWidth + 6, maxRollYPos + 4);
        } else {
            // Traffic light mode: regular interval lines + boundary lines
            const greenBoundary = Math.max(maxRollAngle - 5, 0);
            const redBoundary = maxRollAngle;

            // Small horizontal lines at every 1° through the bar
            for (let deg = 1; deg < colorScaleMax; deg++) {
                const yPos = legendBarBottom - (deg / colorScaleMax) * legendBarHeight;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(legendBarX, yPos);
                ctx.lineTo(legendBarX + legendBarWidth, yPos);
                ctx.stroke();
            }

            // Thick white boundary lines at zone transitions
            const boundaries = [
                { value: 0, label: '0' },
                { value: greenBoundary, label: `${greenBoundary}` },
                { value: redBoundary, label: `${redBoundary}` },
            ];

            for (const { value, label } of boundaries) {
                const yPos = legendBarBottom - (value / colorScaleMax) * legendBarHeight;

                // White line through bar (at zone boundaries)
                if (value > 0) {
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.moveTo(legendBarX - 1, yPos);
                    ctx.lineTo(legendBarX + legendBarWidth + 1, yPos);
                    ctx.stroke();
                }

                // Tick mark
                ctx.strokeStyle = '#AAAAAA';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(legendBarX + legendBarWidth, yPos);
                ctx.lineTo(legendBarX + legendBarWidth + 4, yPos);
                ctx.stroke();

                // Value label
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(label, legendBarX + legendBarWidth + 6, yPos);
            }

            // Labels at every 5° (without boundary lines)
            for (let deg = 5; deg < colorScaleMax; deg += 5) {
                if (deg === greenBoundary || deg === redBoundary) continue;
                const yPos = legendBarBottom - (deg / colorScaleMax) * legendBarHeight;

                ctx.strokeStyle = '#AAAAAA';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(legendBarX + legendBarWidth, yPos);
                ctx.lineTo(legendBarX + legendBarWidth + 4, yPos);
                ctx.stroke();

                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(`${deg}`, legendBarX + legendBarWidth + 6, yPos);
            }
        }

    }, [rollMatrix, speeds, headings, vesselHeading, vesselSpeed, maxRollAngle, meanWaveDirection, width, height, mode, orientation]);

    return <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} />;
});
