/**
 * Parameter Validation Utility
 */

export interface ValidationResult {
  isValid: boolean;
  outOfRange: boolean;
  minValue?: number;
  maxValue?: number;
}

export interface ParameterValidation {
  draftAft: ValidationResult;
  draftFore: ValidationResult;
  gm: ValidationResult;
  heading: ValidationResult;
  speed: ValidationResult;
  maxRoll: ValidationResult;
  hs: ValidationResult;
  tz: ValidationResult;
  waveDirection: ValidationResult;
}

export class ParameterValidator {
  /**
   * Validate a single parameter against bounds
   */
  static validateParameter(
    value: number,
    minValue: number,
    maxValue: number
  ): ValidationResult {
    const isValid = value >= minValue && value <= maxValue;
    return {
      isValid,
      outOfRange: !isValid,
      minValue,
      maxValue,
    };
  }

  /**
   * Validate all parameters
   */
  static validateAll(
    draftAft: number,
    draftFore: number,
    gm: number,
    heading: number,
    speed: number,
    maxRoll: number,
    hs: number,
    tz: number,
    waveDirection: number,
    bounds: {
      gmLower: number;
      gmUpper: number;
      hsLower: number;
      hsUpper: number;
      tzLower: number;
      tzUpper: number;
    }
  ): ParameterValidation {
    return {
      draftAft: this.validateParameter(draftAft, 0, 50),
      draftFore: this.validateParameter(draftFore, 0, 50),
      gm: this.validateParameter(gm, bounds.gmLower, bounds.gmUpper),
      heading: this.validateParameter(heading, 0, 360),
      speed: this.validateParameter(speed, 0, 30),
      maxRoll: this.validateParameter(maxRoll, 0, 60),
      hs: this.validateParameter(hs, bounds.hsLower, bounds.hsUpper),
      tz: this.validateParameter(tz, bounds.tzLower, bounds.tzUpper),
      waveDirection: this.validateParameter(waveDirection, 0, 360),
    };
  }

  /**
   * Check if all parameters are valid
   */
  static allValid(validation: ParameterValidation): boolean {
    return Object.values(validation).every((v) => v.isValid);
  }
}
