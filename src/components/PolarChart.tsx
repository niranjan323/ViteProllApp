import React, { useEffect, useRef } from 'react';
import './PolarChart.css';

export type VisualizationMode = 'continuous' | 'trafficLight';
export type OrientationMode = 'northUp' | 'vesselHeadingUp';

interface PolarChartProps {
  rollMatrix: number[][] | null;
  speeds: number[];
  headings: number[];
  maxRollAngle: number;
  vesselHeading: number;
  visualizationMode: VisualizationMode;
  orientationMode: OrientationMode;
  width?: number;
  height?: number;
}

const PolarChart: React.FC<PolarChartProps> = ({
  rollMatrix,
  speeds,
  headings,
  maxRollAngle,
  vesselHeading,
  visualizationMode,
  orientationMode,
  width = 600,
  height = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !rollMatrix) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 40;

    // Draw grid and labels
    drawGrid(ctx, centerX, centerY, maxRadius, speeds);

    // Draw polar plot data
    if (rollMatrix.length > 0 && headings.length > 0) {
      drawPolarData(
        ctx,
        rollMatrix,
        headings,
        speeds,
        centerX,
        centerY,
        maxRadius,
        maxRollAngle,
        visualizationMode,
        orientationMode,
        vesselHeading
      );
    }

    // Draw legend
    drawLegend(ctx, visualizationMode, maxRollAngle, width, height);
  }, [rollMatrix, speeds, headings, maxRollAngle, vesselHeading, visualizationMode, orientationMode, width, height]);

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    maxRadius: number,
    speeds: number[]
  ) => {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    // Draw concentric circles for speed
    const speedLevels = speeds.length > 0 ? speeds : [5, 10, 15, 20, 25];
    const maxSpeed = Math.max(...speedLevels);

    speedLevels.forEach((speed) => {
      const radius = (speed / maxSpeed) * maxRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();

      // Speed label
      ctx.fillText(`${speed}kts`, centerX, centerY - radius - 5);
    });

    // Draw radial lines for headings
    ctx.strokeStyle = '#d0d0d0';
    for (let heading = 0; heading < 360; heading += 30) {
      const rad = (heading * Math.PI) / 180;
      const x1 = centerX + maxRadius * Math.cos(rad);
      const y1 = centerY + maxRadius * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Heading label
      const labelRad = (heading * Math.PI) / 180;
      const labelX = centerX + (maxRadius + 20) * Math.cos(labelRad);
      const labelY = centerY + (maxRadius + 20) * Math.sin(labelRad);
      ctx.fillStyle = '#000';
      ctx.fillText(`${heading}°`, labelX, labelY);
    }
  };

  const drawPolarData = (
    ctx: CanvasRenderingContext2D,
    rollMatrix: number[][],
    headings: number[],
    speeds: number[],
    centerX: number,
    centerY: number,
    maxRadius: number,
    maxRollAngle: number,
    visualizationMode: VisualizationMode,
    orientationMode: OrientationMode,
    vesselHeading: number
  ) => {
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 25;

    rollMatrix.forEach((speedRow, speedIdx) => {
      if (speedIdx >= speeds.length) return;

      speedRow.forEach((rollAngle, headingIdx) => {
        if (headingIdx >= headings.length) return;

        const speed = speeds[speedIdx];
        const heading = headings[headingIdx];

        // Apply orientation offset
        let plotHeading = heading;
        if (orientationMode === 'vesselHeadingUp') {
          plotHeading = heading - vesselHeading;
          if (plotHeading < 0) plotHeading += 360;
        }

        const rad = (plotHeading * Math.PI) / 180;
        const radius = (speed / maxSpeed) * maxRadius;

        const x = centerX + radius * Math.cos(rad);
        const y = centerY + radius * Math.sin(rad);

        // Get color based on visualization mode
        const color = getColor(rollAngle, maxRollAngle, visualizationMode);

        // Draw point
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  };

  const getColor = (rollAngle: number, maxRollAngle: number, mode: VisualizationMode): string => {
    if (mode === 'trafficLight') {
      if (rollAngle <= maxRollAngle - 5) return '#00aa00'; // Green
      if (rollAngle <= maxRollAngle) return '#ffaa00'; // Yellow
      return '#ff0000'; // Red
    } else {
      // Continuous mode - color gradient
      const normalizedRoll = Math.min(rollAngle / maxRollAngle, 2);
      if (normalizedRoll <= 0.5) {
        return `hsl(120, 100%, ${100 - normalizedRoll * 100}%)`;
      } else if (normalizedRoll <= 1) {
        return `hsl(${120 - (normalizedRoll - 0.5) * 240}, 100%, 50%)`;
      } else {
        return '#ff0000';
      }
    }
  };

  const drawLegend = (
    ctx: CanvasRenderingContext2D,
    mode: VisualizationMode,
    maxRollAngle: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const legendX = 20;
    const legendY = canvasHeight - 80;

    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Legend:', legendX, legendY);

    if (mode === 'trafficLight') {
      const items = [
        { color: '#00aa00', label: `Safe (0-${maxRollAngle - 5}°)` },
        { color: '#ffaa00', label: `Caution (${maxRollAngle - 5}-${maxRollAngle}°)` },
        { color: '#ff0000', label: `Danger (>${maxRollAngle}°)` },
      ];

      items.forEach((item, idx) => {
        const y = legendY + 20 + idx * 15;
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, y, 15, 15);
        ctx.fillStyle = '#000';
        ctx.font = '11px Arial';
        ctx.fillText(item.label, legendX + 20, y + 12);
      });
    } else {
      ctx.font = '11px Arial';
      ctx.fillStyle = '#000';
      ctx.fillText('Green: Safe', legendX, legendY + 20);
      ctx.fillText('Yellow: Warning', legendX, legendY + 35);
      ctx.fillText('Red: Danger', legendX, legendY + 50);
    }
  };

  return (
    <div className="polar-chart-container">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="polar-chart-canvas"
      />
    </div>
  );
};

export default PolarChart;
