/**
 * Case Manager Service - Handles saving, loading, and deleting analysis cases
 */

export interface AnalysisCase {
  id: string;
  timestamp: number;
  vesselData: {
    draftAft: number;
    draftFore: number;
    gm: number;
    heading: number;
    speed: number;
    maxRoll: number;
  };
  seaState: {
    hs: number;
    tz: number;
    waveDirection: number;
  };
  dataFilePath: string;
}

export class CaseManager {
  private cases: Map<string, AnalysisCase> = new Map();

  /**
   * Add a new case
   */
  addCase(caseId: string, data: AnalysisCase): void {
    if (caseId.length > 12) {
      throw new Error('Case ID must be 12 characters or less');
    }
    this.cases.set(caseId, data);
  }

  /**
   * Get a case by ID
   */
  getCase(caseId: string): AnalysisCase | undefined {
    return this.cases.get(caseId);
  }

  /**
   * Get all case IDs
   */
  getAllCaseIds(): string[] {
    return Array.from(this.cases.keys()).sort();
  }

  /**
   * Delete a case
   */
  deleteCase(caseId: string): boolean {
    return this.cases.delete(caseId);
  }

  /**
   * Check if case exists
   */
  caseExists(caseId: string): boolean {
    return this.cases.has(caseId);
  }

  /**
   * Get all cases
   */
  getAllCases(): AnalysisCase[] {
    return Array.from(this.cases.values());
  }

  /**
   * Clear all cases
   */
  clearCases(): void {
    this.cases.clear();
  }
}
