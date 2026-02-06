import React, { useEffect, useRef } from 'react';

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

function normalizeAngle(angle: number): number {
    let a = angle % 360;
    if (a < 0) a += 360;
    return a;
}

function interpolateRoll(
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

export const CanvasPolarChart: React.FC<CanvasPolarChartProps> = ({
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
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Smooth color interpolation helper
    const interpolateColor = (stops: Array<{value: number, color: [number, number, number]}>, value: number): [number, number, number] => {
        if (value <= stops[0].value) return stops[0].color;
        if (value >= stops[stops.length - 1].value) return stops[stops.length - 1].color;

        for (let i = 0; i < stops.length - 1; i++) {
            if (value >= stops[i].value && value <= stops[i + 1].value) {
                const t = (value - stops[i].value) / (stops[i + 1].value - stops[i].value);
                const r = stops[i].color[0] + t * (stops[i + 1].color[0] - stops[i].color[0]);
                const g = stops[i].color[1] + t * (stops[i + 1].color[1] - stops[i].color[1]);
                const b = stops[i].color[2] + t * (stops[i + 1].color[2] - stops[i].color[2]);
                return [r, g, b];
            }
        }
        return stops[stops.length - 1].color;
    };

    const getContinuousColorRGB = (rollAngle: number, colorMax: number): [number, number, number] => {
        const normalizedValue = Math.min(rollAngle / colorMax, 1.0);

        const colorStops = [
            { value: 0.0,  color: [0, 29, 65] as [number, number, number] },       // #001D41
            { value: 0.06, color: [1, 43, 79] as [number, number, number] },       // #012B4F
            { value: 0.12, color: [2, 31, 148] as [number, number, number] },      // #021F94
            { value: 0.18, color: [17, 87, 179] as [number, number, number] },     // #1157B3
            { value: 0.24, color: [20, 115, 230] as [number, number, number] },    // #1473E6
            { value: 0.30, color: [66, 105, 216] as [number, number, number] },    // #4269D8
            { value: 0.36, color: [20, 146, 230] as [number, number, number] },    // #1492E6
            { value: 0.42, color: [25, 150, 244] as [number, number, number] },    // #1996F4
            { value: 0.48, color: [77, 196, 255] as [number, number, number] },    // #4DC4FF
            { value: 0.54, color: [116, 197, 255] as [number, number, number] },   // #74C5FF
            { value: 0.60, color: [117, 167, 226] as [number, number, number] },   // #75A7E2
            { value: 0.66, color: [157, 175, 191] as [number, number, number] },   // #9DAFBF
            { value: 0.72, color: [255, 255, 255] as [number, number, number] },   // #FFFFFF
            { value: 0.80, color: [255, 236, 116] as [number, number, number] },   // #FFEC74
            { value: 0.88, color: [255, 160, 40] as [number, number, number] },    // Orange
            { value: 0.94, color: [228, 38, 43] as [number, number, number] },     // #E4262B
            { value: 1.0,  color: [165, 0, 38] as [number, number, number] },      // #A50026
        ];

        return interpolateColor(colorStops, normalizedValue);
    };

    const getTrafficLightColorRGB = (value: number, maxRoll: number): [number, number, number] => {
        const greenThreshold = maxRoll - 5;
        const yellowThreshold = maxRoll;

        if (value <= greenThreshold) {
            return [9, 190, 94]; // #09BE5E
        } else if (value <= yellowThreshold) {
            const t = (value - greenThreshold) / 5;
            return [
                Math.round(9 + t * (255 - 9)),
                Math.round(190 + t * (236 - 190)),
                Math.round(94 + t * (116 - 94))
            ];
        } else {
            const t = Math.min((value - yellowThreshold) / 5, 1);
            return [
                Math.round(255 - t * (255 - 247)),
                Math.round(236 - t * (236 - 17)),
                Math.round(116 - t * (116 - 106))
            ];
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


        const colorScaleMax = maxRollAngle;

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
                        ? getContinuousColorRGB(rollValue, colorScaleMax)
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

        const boatLength = 22;
        const boatWidth = 10;

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#012B4F';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -boatLength / 2);
        ctx.quadraticCurveTo(boatWidth / 2, -boatLength / 4, boatWidth / 2, boatLength / 4);
        ctx.lineTo(boatWidth / 4, boatLength / 2);
        ctx.lineTo(-boatWidth / 4, boatLength / 2);
        ctx.lineTo(-boatWidth / 2, boatLength / 4);
        ctx.quadraticCurveTo(-boatWidth / 2, -boatLength / 4, 0, -boatLength / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#1473E6';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -boatLength / 2 + 3);
        ctx.lineTo(0, boatLength / 2 - 3);
        ctx.stroke();

        ctx.fillStyle = '#1473E6';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, 2 * Math.PI);
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

        // Draw gradient bar
        if (mode === 'continuous') {
            for (let i = 0; i <= legendBarHeight; i++) {
                const rollValue = (colorScaleMax * (legendBarHeight - i)) / legendBarHeight;
                const [r, g, b] = getContinuousColorRGB(rollValue, colorScaleMax);
                ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
                ctx.fillRect(legendBarX, legendBarTop + i, legendBarWidth, 1);
            }
        } else {
            for (let i = 0; i <= legendBarHeight; i++) {
                const rollValue = (maxRollAngle * 1.5 * (legendBarHeight - i)) / legendBarHeight;
                const [r, g, b] = getTrafficLightColorRGB(rollValue, maxRollAngle);
                ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
                ctx.fillRect(legendBarX, legendBarTop + i, legendBarWidth, 1);
            }
        }

        // Legend border
        ctx.strokeStyle = '#AAAAAA';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendBarX, legendBarTop, legendBarWidth, legendBarHeight);

        // Legend tick marks and values - WHITE text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const maxLegendValue = Math.ceil(colorScaleMax);
        const tickCount = 6;
        for (let i = 0; i <= tickCount; i++) {
            const value = Math.round((maxLegendValue * i) / tickCount);
            const yPos = legendBarBottom - (i / tickCount) * legendBarHeight;

            // Tick mark
            ctx.strokeStyle = '#AAAAAA';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(legendBarX + legendBarWidth, yPos);
            ctx.lineTo(legendBarX + legendBarWidth + 4, yPos);
            ctx.stroke();

            // Value label - WHITE
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(`${value}`, legendBarX + legendBarWidth + 6, yPos);
        }

        // "Max roll" indicator line on legend
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

    }, [rollMatrix, speeds, headings, vesselHeading, vesselSpeed, maxRollAngle, meanWaveDirection, width, height, mode, orientation]);

    return <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} />;
};
