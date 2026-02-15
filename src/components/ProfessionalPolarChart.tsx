import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { Data, Layout, Config } from 'plotly.js';

interface ProfessionalPolarChartProps {
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

export const ProfessionalPolarChart: React.FC<ProfessionalPolarChartProps> = ({
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
    // Create custom colorscale for continuous mode
    const continuousColorscale: [number, string][] = [
        [0.0, '#0032B4'],    // Deep blue (0°)
        [0.1, '#0096FF'],    // Blue (3°)
        [0.167, '#00FAFF'],  // Cyan (5°)
        [0.233, '#32C832'],  // Green (7°)
        [0.3, '#96FA00'],    // Yellow-green (9°)
        [0.367, '#FFFA00'],  // Yellow (11°)
        [0.467, '#FF9600'],  // Orange (14°)
        [0.6, '#FF5000'],    // Red-orange (18°)
        [0.8, '#DD0055'],    // Deep red (24°)
        [1.0, '#AA0066'],    // Magenta (30°+)
    ];

    // Traffic light colorscale
    const trafficLightColorscale: [number, string][] = [
        [0.0, '#00DD00'],    // Green
        [0.66, '#00DD00'],   // Green
        [0.67, '#FFDD00'],   // Yellow
        [0.99, '#FFDD00'],   // Yellow
        [1.0, '#DD0055'],    // Red
    ];

    // Create smooth contour data using dense scatter points with overlapping markers
    const contourTrace = useMemo(() => {
        const numAngularPoints = 720; // Very high resolution
        const numRadialPoints = 150; // Dense radial sampling
        const maxSpeed = 25;

        const r: number[] = [];
        const theta: number[] = [];
        const colors: number[] = [];

        // Create dense grid of points
        for (let radialIdx = 0; radialIdx < numRadialPoints; radialIdx++) {
            const radius = (radialIdx * maxSpeed) / numRadialPoints;

            for (let angleIdx = 0; angleIdx < numAngularPoints; angleIdx++) {
                const angle = (angleIdx * 360) / numAngularPoints;

                // Bilinear interpolation from roll matrix
                const speedFraction = (radius * (speeds.length - 1)) / Math.max(...speeds);
                const angleFraction = (angle * (headings.length - 1)) / 360;

                const s0 = Math.floor(Math.min(speedFraction, speeds.length - 1));
                const s1 = Math.min(s0 + 1, speeds.length - 1);
                const a0 = Math.floor(angleFraction);
                const a1 = (a0 + 1) % headings.length;

                const sWeight = speedFraction - s0;
                const aWeight = angleFraction - a0;

                const roll00 = rollMatrix[s0]?.[a0] ?? 0;
                const roll01 = rollMatrix[s0]?.[a1] ?? 0;
                const roll10 = rollMatrix[s1]?.[a0] ?? 0;
                const roll11 = rollMatrix[s1]?.[a1] ?? 0;

                const roll0 = roll00 * (1 - sWeight) + roll10 * sWeight;
                const roll1 = roll01 * (1 - sWeight) + roll11 * sWeight;
                const rollValue = roll0 * (1 - aWeight) + roll1 * aWeight;

                // Apply orientation transformation
                let displayAngle = angle;
                if (orientation === 'heads-up') {
                    displayAngle = (angle - vesselHeading + 360) % 360;
                }

                r.push(radius);
                theta.push(displayAngle);
                colors.push(rollValue);
            }
        }

        const trace: Data = {
            type: 'scatterpolar',
            mode: 'markers',
            r: r,
            theta: theta,
            marker: {
                size: 6, // Larger markers to overlap and blend
                color: colors,
                colorscale: mode === 'continuous' ? continuousColorscale : trafficLightColorscale,
                cmin: 0,
                cmax: Math.max(maxRollAngle * 1.2, 30),
                showscale: true,
                colorbar: {
                    title: {
                        text: 'Roll [deg]',
                        side: 'right',
                    },
                    thickness: 25,
                    len: 0.7,
                    x: -0.15,
                    xanchor: 'right',
                    yanchor: 'middle',
                    y: 0.5,
                    tickfont: {
                        size: 11,
                    },
                },
                line: {
                    width: 0,
                },
                opacity: 0.95, // Slight transparency for blending
            },
            hovertemplate: 'Angle: %{theta}°<br>Speed: %{r:.1f} kn<br>Roll: %{marker.color:.1f}°<extra></extra>',
            showlegend: false,
        };

        return trace;
    }, [rollMatrix, speeds, headings, vesselHeading, maxRollAngle, mode, orientation]);

    // Calculate display angles for wave and vessel
    const displayWaveAngle = orientation === 'heads-up'
        ? (meanWaveDirection - vesselHeading + 360) % 360
        : meanWaveDirection;

    const displayVesselAngle = orientation === 'heads-up' ? 0 : vesselHeading;

    // Wave direction arrow trace
    const waveArrowTrace: Data = {
        type: 'scatterpolar',
        mode: 'lines+markers',
        r: [0, 23],
        theta: [displayWaveAngle, displayWaveAngle],
        line: {
            color: 'rgba(255, 255, 0, 0.9)',
            width: 4,
        },
        marker: {
            size: [0, 16],
            symbol: 'triangle-up',
            color: 'rgba(255, 255, 0, 0.9)',
        },
        name: 'Wave Direction',
        showlegend: true,
        hoverinfo: 'skip',
    };

    // Vessel heading indicator trace
    const vesselIndicatorTrace: Data = {
        type: 'scatterpolar',
        mode: 'lines+markers',
        r: [0, Math.min(vesselSpeed, 25)],
        theta: [displayVesselAngle, displayVesselAngle],
        line: {
            color: 'rgba(255, 0, 0, 0.9)',
            width: 5,
        },
        marker: {
            size: [14, 20],
            symbol: ['circle', 'arrow-up'],
            color: 'rgba(255, 0, 0, 0.9)',
            line: {
                color: 'white',
                width: 2,
            },
        },
        name: 'Vessel',
        showlegend: true,
        hoverinfo: 'skip',
    };

    // Layout configuration
    const layout: Partial<Layout> = {
        polar: {
            radialaxis: {
                visible: true,
                range: [0, 25],
                angle: 90,
                tickmode: 'linear',
                tick0: 0,
                dtick: 5,
                showline: true,
                showgrid: true,
                gridcolor: 'rgba(0, 0, 0, 0.3)',
                gridwidth: 1,
                tickfont: {
                    size: 12,
                    color: '#333',
                },
                layer: 'above traces',
            },
            angularaxis: {
                visible: true,
                direction: 'clockwise',
                rotation: 90,
                tickmode: 'array',
                tickvals: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
                ticktext: ['N<br>0°', '30°', '60°', 'E<br>90°', '120°', '150°', 'S<br>180°', '210°', '240°', 'W<br>270°', '300°', '330°'],
                showline: true,
                showgrid: true,
                gridcolor: 'rgba(0, 0, 0, 0.3)',
                gridwidth: 1,
                tickfont: {
                    size: 11,
                    color: '#333',
                },
                layer: 'above traces',
            },
            bgcolor: 'rgba(245, 245, 245, 0.3)',
        },
        width,
        height,
        margin: {
            l: 120,
            r: 80,
            t: 60,
            b: 80,
        },
        legend: {
            x: 0.85,
            y: 0.98,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            bordercolor: '#333',
            borderwidth: 1,
            font: {
                size: 11,
            },
        },
        title: {
            text: orientation === 'north-up' ? 'Polar Roll Plot (North-Up)' : 'Polar Roll Plot (Heads-Up)',
            font: {
                size: 16,
                color: '#333',
                weight: 600,
            },
            y: 0.97,
        },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
    };

    // Configuration
    const config: Partial<Config> = {
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        toImageButtonOptions: {
            format: 'png',
            filename: 'polar_roll_plot',
            height: 1200,
            width: 1200,
            scale: 2,
        },
    };

    return (
        <Plot
            data={[contourTrace, waveArrowTrace, vesselIndicatorTrace]}
            layout={layout}
            config={config}
            style={{ width: '100%', height: '100%' }}
        />
    );
};
