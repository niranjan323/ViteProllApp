/**
 * Polar Calculations Service
 * Utility functions for polar coordinate transformations and calculations
 */

export class PolarCalculations {
  /**
   * Convert angle from degrees to radians
   */
  static toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Convert angle from radians to degrees
   */
  static toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }

  /**
   * Normalize angle to 0-360 range
   */
  static normalizeAngle(angle: number): number {
    let normalized = angle % 360;
    if (normalized < 0) normalized += 360;
    return normalized;
  }

  /**
   * Calculate angle difference (shortest path)
   */
  static angleDifference(angle1: number, angle2: number): number {
    let diff = angle2 - angle1;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return diff;
  }

  /**
   * Convert vessel coordinates to North-up display coordinates
   */
  static toNorthUp(vesselAngle: number, vesselHeading: number): number {
    let displayAngle = 180 + (vesselHeading - vesselAngle);
    return this.normalizeAngle(displayAngle);
  }

  /**
   * Convert vessel coordinates to Heads-up display coordinates
   */
  static toHeadsUp(vesselAngle: number): number {
    let displayAngle = 180 - vesselAngle;
    return this.normalizeAngle(displayAngle);
  }

  /**
   * Convert wave direction for display
   */
  static convertWaveDirection(waveDirection: number, vesselHeading: number, mode: 'northup' | 'headsup'): number {
    if (mode === 'northup') {
      return this.normalizeAngle(waveDirection);
    } else {
      return this.normalizeAngle(waveDirection - vesselHeading);
    }
  }

  /**
   * Cartesian to Polar coordinates
   */
  static cartesianToPolar(x: number, y: number): { r: number; theta: number } {
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    return { r, theta: this.toDegrees(theta) };
  }

  /**
   * Polar to Cartesian coordinates
   */
  static polarToCartesian(r: number, theta: number): { x: number; y: number } {
    const rad = this.toRadians(theta);
    return {
      x: r * Math.cos(rad),
      y: r * Math.sin(rad),
    };
  }

  /**
   * Check if vessel is in danger zone
   */
  static isInDangerZone(rollAngle: number, maxAllowed: number): boolean {
    return rollAngle > maxAllowed;
  }

  /**
   * Get traffic light color based on roll angle
   */
  static getTrafficLightColor(rollAngle: number, maxAllowed: number): 'green' | 'yellow' | 'red' {
    if (rollAngle <= maxAllowed - 5) return 'green';
    if (rollAngle <= maxAllowed) return 'yellow';
    return 'red';
  }

  /**
   * Calculate average draft
   */
  static calculateAverageDraft(aftDraft: number, foreDraft: number): number {
    return (aftDraft + foreDraft) / 2;
  }

  /**
   * Calculate distance between two parameter points
   */
  static parameterDistance(
    params1: { hs: number; tz: number; gm: number },
    params2: { hs: number; tz: number; gm: number },
    weights: { hs: number; tz: number; gm: number } = { hs: 1, tz: 1, gm: 1 }
  ): number {
    const hsDistSq = Math.pow((params1.hs - params2.hs) * weights.hs, 2);
    const tzDistSq = Math.pow((params1.tz - params2.tz) * weights.tz, 2);
    const gmDistSq = Math.pow((params1.gm - params2.gm) * weights.gm, 2);

    return Math.sqrt(hsDistSq + tzDistSq + gmDistSq);
  }

  /**
   * Find closest value in array
   */
  static findClosestValue(array: number[], target: number): number | null {
    if (!array || array.length === 0) return null;

    let closest = array[0];
    let minDiff = Math.abs(array[0] - target);

    for (let i = 1; i < array.length; i++) {
      const diff = Math.abs(array[i] - target);
      if (diff < minDiff) {
        minDiff = diff;
        closest = array[i];
      }
    }

    return closest;
  }

  /**
   * Find closest index in array
   */
  static findClosestIndex(array: number[], target: number): number {
    if (!array || array.length === 0) return -1;

    let closestIdx = 0;
    let minDiff = Math.abs(array[0] - target);

    for (let i = 1; i < array.length; i++) {
      const diff = Math.abs(array[i] - target);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    return closestIdx;
  }

  /**
   * Get color for continuous plot based on value
   * Blue -> Cyan -> Green -> Yellow -> Orange -> Red
   */
  static getContinuousColor(value: number, maxValue: number): string {
    const ratio = Math.min(value / maxValue, 1);

    if (ratio < 0.2) {
      const t = ratio / 0.2;
      return this.interpolateColor([13, 71, 161], [25, 118, 210], t);
    } else if (ratio < 0.4) {
      const t = (ratio - 0.2) / 0.2;
      return this.interpolateColor([25, 118, 210], [0, 188, 212], t);
    } else if (ratio < 0.6) {
      const t = (ratio - 0.4) / 0.2;
      return this.interpolateColor([0, 188, 212], [255, 235, 59], t);
    } else if (ratio < 0.8) {
      const t = (ratio - 0.6) / 0.2;
      return this.interpolateColor([255, 235, 59], [255, 152, 0], t);
    } else {
      const t = (ratio - 0.8) / 0.2;
      return this.interpolateColor([255, 152, 0], [244, 67, 54], t);
    }
  }

  /**
   * Interpolate between two RGB colors
   */
  static interpolateColor(color1: [number, number, number], color2: [number, number, number], factor: number): string {
    const r = Math.round(color1[0] + (color2[0] - color1[0]) * factor);
    const g = Math.round(color1[1] + (color2[1] - color1[1]) * factor);
    const b = Math.round(color1[2] + (color2[2] - color1[2]) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Format angle for display
   */
  static formatAngle(angle: number): string {
    return `${this.normalizeAngle(angle).toFixed(0)}°`;
  }

  /**
   * Format speed for display
   */
  static formatSpeed(speed: number): string {
    return `${speed.toFixed(1)} kn`;
  }
}
