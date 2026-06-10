import type { IFileSystemService } from './IFileSystemService';

/**
 * DataLoader Service - Handles loading and parsing control and polar data files
 */

export interface VesselInfo {
  imo: string;
  name: string;
}

export interface ParameterBounds {
  draftLower: number;
  draftUpper: number;
  gmLower: number;
  gmUpper: number;
  speedLower: number;
  speedUpper: number;
  rollLower: number;
  rollUpper: number;
  hsLower: number;
  hsUpper: number;
  tzLower: number;
  tzUpper: number;
}

export interface RepresentativeDrafts {
  scantling: number;
  design: number;
  intermediate: number;
}

export interface PolarData {
  speeds: number[];
  headings: number[];
  rollMatrix: number[][];
  numSpeeds: number;
  numHeadings: number;
  numParameters: number;
}

export interface LoadControlFileResult {
  success: boolean;
  vesselInfo?: VesselInfo;
  parameterBounds?: ParameterBounds;
  representativeDrafts?: RepresentativeDrafts;
  error?: string;
}

export interface FindDataFileResult {
  success: boolean;
  filePath?: string;
  fittedDraft?: number;
  error?: string;
}

export interface LoadPolarDataResult {
  success: boolean;
  data?: PolarData;
  fittedGM?: number;
  fittedHs?: number;
  fittedTz?: number;
  error?: string;
}

export class DataLoader {
  private fs: IFileSystemService;

  constructor(fileSystemService: IFileSystemService) {
    this.fs = fileSystemService;
  }

  /**
   * Load and parse the control file
   */
  async loadControlFile(controlFilePath: string): Promise<LoadControlFileResult> {
    try {
      const text = await this.fs.readTextFile(controlFilePath);

      // Parse control file - supports two strategies (tried in order):
      //   1. Comment-based: find line by keyword in comment after "!"
      //   2. Positional:    fixed line order (works even with no comments)
      //
      // Fixed order (blank lines ignored):
      //   0: IMO number
      //   1: Draft min, max
      //   2: GM min, max
      //   3: Speed min, max
      //   4: Roll min, max
      //   5: Hs min, max
      //   6: Tz min, max
      //   7: Td design draft      (optional)
      //   8: Ti intermediate draft (optional)
      //   9: Ts scantling draft    (optional)
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('!')); // skip blank + comment-only lines

      // Helper: strip comment, return numeric tokens from a line
      const parseLine = (line: string): string[] => {
        const dataPart = line.split('!')[0].trim();
        return dataPart.split(/\s+/).filter(s => s.length > 0);
      };

      // Helper: find a line by keyword in its comment part (case-insensitive)
      const findLineByComment = (keyword: string): string | undefined =>
        lines.find(l => {
          const bang = l.indexOf('!');
          if (bang === -1) return false;
          return l.substring(bang + 1).toLowerCase().includes(keyword.toLowerCase());
        });

      // Helper: find key=value anywhere in the file
      const findKeyValue = (key: string): number | null => {
        const re = new RegExp(`^${key}\\s*=\\s*([\\d.]+)`, 'i');
        for (const l of lines) {
          const m = l.match(re);
          if (m) return parseFloat(m[1]);
        }
        return null;
      };

      // Helper: positional fallback — value at (lineIndex, tokenIndex) in the non-empty lines array
      const posVal = (lineIdx: number, valIdx: number): number | null => {
        if (lineIdx >= lines.length) return null;
        const vals = parseLine(lines[lineIdx]);
        const v = parseFloat(vals[valIdx] ?? '');
        return isNaN(v) ? null : v;
      };

      // Helper: comment-based first, then key=value, then positional
      const resolve = (
        commentLine: string | undefined,
        tokenIdx: number,
        keyName: string,
        posLineIdx: number,
        posTokenIdx: number
      ): number | null => {
        if (commentLine) {
          const vals = parseLine(commentLine);
          if (vals[tokenIdx] !== undefined) {
            const v = parseFloat(vals[tokenIdx]);
            if (!isNaN(v)) return v;
          }
        }
        return findKeyValue(keyName) ?? posVal(posLineIdx, posTokenIdx);
      };

      // --- IMO (line 0) ---
      const imoLine = findLineByComment('imo') || findLineByComment('vessel');
      const imoValues = imoLine ? parseLine(imoLine) : parseLine(lines[0] ?? '');
      const vesselInfo: VesselInfo = {
        imo: imoValues[0] || 'Unknown',
        name: 'Unknown',
      };

      // --- Draft bounds — line 1 (optional, default 0–50) ---
      const draftLine = findLineByComment('draft');
      const draftLower = resolve(draftLine, 0, 'Draft_lower', 1, 0) ?? 0;
      const draftUpper = resolve(draftLine, 1, 'Draft_upper', 1, 1) ?? 50;

      // --- GM bounds — line 2 (REQUIRED) ---
      const gmLine = findLineByComment('gm');
      const gmLower = resolve(gmLine, 0, 'GM_lower', 2, 0);
      const gmUpper = resolve(gmLine, 1, 'GM_upper', 2, 1);
      if (gmLower === null || isNaN(gmLower)) {
        return { success: false, error: 'Control file is missing required range: GM lower bound' };
      }
      if (gmUpper === null || isNaN(gmUpper)) {
        return { success: false, error: 'Control file is missing required range: GM upper bound' };
      }

      // --- Speed bounds — line 3 (optional, default 0–30) ---
      const speedLine = findLineByComment('speed');
      const speedLower = resolve(speedLine, 0, 'Speed_lower', 3, 0) ?? 0;
      const speedUpper = resolve(speedLine, 1, 'Speed_upper', 3, 1) ?? 30;

      // --- Roll bounds — line 4 (optional, default 0–60) ---
      const rollLine = findLineByComment('allowed roll') || findLineByComment('roll');
      const rollLower = resolve(rollLine, 0, 'Roll_lower', 4, 0) ?? 0;
      const rollUpper = resolve(rollLine, 1, 'Roll_upper', 4, 1) ?? 60;

      // --- Hs bounds — line 5 (REQUIRED) ---
      const hsLine = findLineByComment('wave height') || findLineByComment('hs');
      const hsLower = resolve(hsLine, 0, 'Hs_lower', 5, 0);
      const hsUpper = resolve(hsLine, 1, 'Hs_upper', 5, 1);
      if (hsLower === null || isNaN(hsLower)) {
        return { success: false, error: 'Control file is missing required range: Hs lower bound' };
      }
      if (hsUpper === null || isNaN(hsUpper)) {
        return { success: false, error: 'Control file is missing required range: Hs upper bound' };
      }

      // --- Tz bounds — line 6 (REQUIRED) ---
      const tzLine = findLineByComment('wave period') || findLineByComment('tz');
      const tzLower = resolve(tzLine, 0, 'Tz_lower', 6, 0);
      const tzUpper = resolve(tzLine, 1, 'Tz_upper', 6, 1);
      if (tzLower === null || isNaN(tzLower)) {
        return { success: false, error: 'Control file is missing required range: Tz lower bound' };
      }
      if (tzUpper === null || isNaN(tzUpper)) {
        return { success: false, error: 'Control file is missing required range: Tz upper bound' };
      }

      const parameterBounds: ParameterBounds = {
        draftLower,
        draftUpper,
        gmLower,
        gmUpper,
        speedLower,
        speedUpper,
        rollLower,
        rollUpper,
        hsLower,
        hsUpper,
        tzLower,
        tzUpper,
      };

      // --- Representative drafts — lines 7, 8, 9 (optional) ---
      const tdLine = findLineByComment('td') || findLineByComment('design draft');
      const tiLine = findLineByComment('ti') || findLineByComment('intermediate');
      const tsLine = findLineByComment('ts') || findLineByComment('scantling');

      const representativeDrafts: RepresentativeDrafts = {
        design:       tdLine ? parseFloat(parseLine(tdLine)[0] || '0') : (findKeyValue('td') ?? findKeyValue('design') ?? posVal(7, 0) ?? 0),
        intermediate: tiLine ? parseFloat(parseLine(tiLine)[0] || '0') : (findKeyValue('ti') ?? findKeyValue('intermediate') ?? posVal(8, 0) ?? 0),
        scantling:    tsLine ? parseFloat(parseLine(tsLine)[0] || '0') : (findKeyValue('ts') ?? findKeyValue('scantling') ?? posVal(9, 0) ?? 0),
      };

      console.log('Control file parsed:', { vesselInfo, parameterBounds, representativeDrafts });

      return {
        success: true,
        vesselInfo,
        parameterBounds,
        representativeDrafts,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading control file:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Find the data file that best matches the input parameters.
   * Supports two draft folder naming conventions:
   *   New-style: "Draft=11m", "Draft=15m", "Draft=16m" (numeric matching)
   *   Old-style: "design", "intermediate", "scantling" (mapped to draftLower, mid, draftUpper)
   * Average draft = 0.5 * (draftAft + draftFore) is used to find the closest folder.
   */
  async findDataFile(parameters: {
    draft: number;  // average draft in metres
    gm: number;
    hs: number;
    tz: number;
  }): Promise<FindDataFileResult> {
    try {
      console.log('Looking for files with parameters:', parameters);

      // 1st search: Find closest draft folder in the root of the selected folder
      // Expected naming convention: "Draft=11m", "Draft=15m", "Draft=16m"
      // Filter out files (entries with extensions like .ctl)
      const rootEntries = await this.fs.listDirectory('');
      const draftCandidates = rootEntries.filter(e => /^Draft=/i.test(e));
      console.log('Draft folder candidates:', draftCandidates);

      // Only numeric-named folders are supported (e.g. Draft=11m)
      const draftFolder = this.findClosestMatch(draftCandidates, parameters.draft, 'Draft');

      console.log('Selected draft folder:', draftFolder);

      if (!draftFolder) {
        const found = draftCandidates.join(', ') || '(none)';
        return {
          success: false,
          error: `No valid draft folder found. Expected folders named like "Draft=11m". Found: ${found}`,
        };
      }

      // Extract the numeric draft value directly from the folder name 
      // Format: "Draft=15.90m" → 15.90 (supports decimal places)
      const draftNumMatch = draftFolder.match(/Draft=(\d+(?:\.\d+)?)m/i);
      if (!draftNumMatch) {
        return {
          success: false,
          error: `Draft folder "${draftFolder}" does not contain a numeric draft value. Expected format: "Draft=15.90m"`,
        };
      }
      const fittedDraft = parseFloat(draftNumMatch[1]);

      const draftPath = draftFolder;

      // 2nd search: Find closest GM=XXm subfolder
      const gmFolders = await this.fs.listDirectory(draftPath);
      console.log('Available GM folders:', gmFolders);

      const gmFolder = this.findClosestMatch(gmFolders, parameters.gm, 'GM');
      console.log('Selected GM folder:', gmFolder);

      if (!gmFolder) {
        return { success: false, error: 'No matching GM folder found' };
      }

      const gmPath = `${draftPath}/${gmFolder}`;

      // 3rd search: Find Hs/Tz data file in bin subfolder
      const binPath = `${gmPath}/bin`;
      const dataFiles = await this.fs.listDirectory(binPath);
      console.log('Available data files:', dataFiles.slice(0, 5));

      const matchingFile = this.findMatchingDataFile(dataFiles, parameters.hs, parameters.tz);
      console.log('Selected data file:', matchingFile);

      if (!matchingFile) {
        return { success: false, error: 'No matching data file found' };
      }

      return {
        success: true,
        filePath: `${binPath}/${matchingFile}`,
        fittedDraft,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error finding data file:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Find the closest matching folder by numeric value
   * Supports folder naming patterns like "Draft=15.90m", "GM=1.5m"
   */
  private findClosestMatch(folders: string[], targetValue: number, _prefix: string): string | null {
    let closest: string | null = null;
    let minDiff = Infinity;

    for (const folder of folders) {
      // Extract numeric value from folder name, supporting decimal places
      // Matches patterns like "Draft=15.90m" -> 15.90, "GM=1.5m" -> 1.5
      const match = folder.match(/=(\d+(?:\.\d+)?)(?:m)?$/i);
      if (!match) {
        // Fallback to generic digit/decimal pattern for compatibility
        const fallback = folder.match(/[\d.]+/);
        if (!fallback) continue;
        const value = parseFloat(fallback[0]);
        const diff = Math.abs(value - targetValue);
        if (diff < minDiff) {
          minDiff = diff;
          closest = folder;
        }
        continue;
      }

      const value = parseFloat(match[1]);
      const diff = Math.abs(value - targetValue);

      if (diff < minDiff) {
        minDiff = diff;
        closest = folder;
      }
    }

    return closest;
  }

  /**
   * Find the matching data file by Hs and Tz parameters
   */
  private findMatchingDataFile(files: string[], hs: number, tz: number): string | null {
    let bestMatch: string | null = null;
    let minDiff = Infinity;

    for (const file of files) {
      // Parse filename like "MAXROLL_H10.0_T10.5.bpolar"
      // H = Significant Wave Height (Hs)
      // T = Mean Wave Period (Tz)
      const hMatch = file.match(/_H([\d.]+)_/);
      const tMatch = file.match(/_T([\d.]+)\./);

      if (!hMatch || !tMatch) continue;

      const fileHs = parseFloat(hMatch[1]);
      const fileTz = parseFloat(tMatch[1]);

      // Calculate distance in parameter space
      const diff = Math.sqrt(Math.pow(fileHs - hs, 2) + Math.pow(fileTz - tz, 2));

      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = file;
      }
    }

    return bestMatch;
  }

  private readDotNetString(_dataView: DataView, bytes: Uint8Array, offset: number): { value: string; newOffset: number } {
    // Read 7-bit encoded integer length
    let length = 0;
    let shift = 0;
    let currentOffset = offset;

    while (currentOffset < bytes.byteLength) {
      const b = bytes[currentOffset];
      currentOffset++;
      length |= (b & 0x7F) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }

    // Read UTF-8 string
    const stringBytes = bytes.slice(currentOffset, currentOffset + length);
    const decoder = new TextDecoder('utf-8');
    const value = decoder.decode(stringBytes);

    return { value, newOffset: currentOffset + length };
  }

  /**
   * Load and parse binary polar data file
   * Format (from C# reference):
   *   - string header1 (.NET length-prefixed)
   *   - string header2 (.NET length-prefixed)
   *   - int32 SpeedCount
   *   - int32 HeadingCount
   *   - string status (.NET length-prefixed)
   *   - For each heading (j=0 to HeadingCount-1):
   *       For each speed (i=0 to SpeedCount-1):
   *         - double speed
   *         - double heading
   *         - double maxRoll
   */
  async loadPolarData(
    filePath: string,
    parameters: { gm: number; hs: number; tz: number }
  ): Promise<LoadPolarDataResult> {
    try {
      const buffer = await this.fs.readBinaryFile(filePath);
      const bytes = new Uint8Array(buffer);
      const dataView = new DataView(buffer);

      let offset = 0;

      console.log('=== PARSING .BPOLAR FILE (C# FORMAT) ===');
      console.log('File size:', buffer.byteLength, 'bytes');

      // Read header1 (.NET length-prefixed string)
      const header1Result = this.readDotNetString(dataView, bytes, offset);
      offset = header1Result.newOffset;
      console.log('Header1:', header1Result.value);

      // Read header2 (.NET length-prefixed string)
      const header2Result = this.readDotNetString(dataView, bytes, offset);
      offset = header2Result.newOffset;
      console.log('Header2:', header2Result.value);

      // Read SpeedCount (int32)
      const numSpeeds = dataView.getInt32(offset, true);
      offset += 4;

      // Read HeadingCount (int32)
      const numHeadings = dataView.getInt32(offset, true);
      offset += 4;

      console.log('Dimensions:', { numSpeeds, numHeadings });

      // Validate dimensions
      if (numSpeeds <= 0 || numSpeeds > 100 || numHeadings <= 0 || numHeadings > 360) {
        return {
          success: false,
          error: `Invalid dimensions: numSpeeds=${numSpeeds}, numHeadings=${numHeadings}`,
        };
      }

      // Read status string (.NET length-prefixed string)
      const statusResult = this.readDotNetString(dataView, bytes, offset);
      offset = statusResult.newOffset;
      console.log('Status:', statusResult.value);

      console.log('Data starts at offset:', offset);

      // Initialize arrays
      const speeds: number[] = new Array(numSpeeds).fill(0);
      const headings: number[] = new Array(numHeadings).fill(0);

      // Roll matrix is [speed][heading] for our rendering, but file stores [heading][speed]
      const rollMatrix: number[][] = [];
      for (let i = 0; i < numSpeeds; i++) {
        rollMatrix.push(new Array(numHeadings).fill(0));
      }

      // Read data: stored as [heading][speed] with triplets (speed, heading, roll)
      let rollCount = 0;
      let rollSum = 0;
      let minRoll = Infinity;
      let maxRoll = -Infinity;

      const expectedBytes = numHeadings * numSpeeds * 3 * 8; // 3 doubles per cell
      console.log(`Expected data size: ${expectedBytes} bytes (${numHeadings} headings × ${numSpeeds} speeds × 3 doubles)`);

      if (offset + expectedBytes > buffer.byteLength) {
        console.warn(`Warning: File may be truncated. Expected ${expectedBytes} bytes, have ${buffer.byteLength - offset} bytes remaining.`);
      }

      for (let j = 0; j < numHeadings; j++) {
        for (let i = 0; i < numSpeeds; i++) {
          if (offset + 24 > buffer.byteLength) {
            console.warn(`Buffer overflow at heading=${j}, speed=${i}, offset=${offset}`);
            break;
          }

          // Read triplet: (speed, heading, rollValue)
          const speedVal = dataView.getFloat64(offset, true);
          offset += 8;

          const headingVal = dataView.getFloat64(offset, true);
          offset += 8;

          const rollVal = dataView.getFloat64(offset, true);
          offset += 8;

          // Store speed and heading values (they repeat, but we capture them)
          speeds[i] = speedVal;
          headings[j] = headingVal;

          // Store roll value in [speed][heading] format for rendering
          rollMatrix[i][j] = rollVal;

          if (isFinite(rollVal) && rollVal >= 0 && rollVal <= 90) {
            rollCount++;
            rollSum += rollVal;
            minRoll = Math.min(minRoll, rollVal);
            maxRoll = Math.max(maxRoll, rollVal);
          }
        }
      }

      // ── Tester specification: transform heading convention in data reading phase ──
      // Step 1: Expand Y=0:180 to Y=0:360 using Z(X, 180+a) = Z(X, 180-a)
      // Step 2: Apply Y1 = 180-Y (with bounds) so head sea (Y=180) → Y1=0 (chart top)
      // After this the chart plots Z(X, Y1) directly — no changes needed in chart code.

      const rollByRawY = new Map<number, number[]>();
      for (let j = 0; j < headings.length; j++) {
        rollByRawY.set(headings[j], rollMatrix.map(sr => sr[j]));
      }

      // Step 1: expand to 0-360
      const expandedY: number[] = [...headings];
      const expandedRolls: number[][] = headings.map((_, j) => rollMatrix.map(sr => sr[j]));
      for (let j = 0; j < headings.length; j++) {
        const a = headings[j];
        if (a === 0) continue;
        const mirrorY = 180 + a;
        if (mirrorY >= 360) continue;
        const sourceRolls = rollByRawY.get(180 - a);
        if (sourceRolls) { expandedY.push(mirrorY); expandedRolls.push(sourceRolls); }
      }

      // Step 2: Y1 = 180-Y, normalise, sort ascending, rebuild arrays
      const xfm = expandedY.map((y, i) => {
        let y1 = 180 - y;
        if (y1 < 0) y1 += 360;
        if (y1 >= 360) y1 -= 360;
        return { y1, rolls: expandedRolls[i] };
      });
      xfm.sort((a, b) => a.y1 - b.y1);

      headings.length = xfm.length;
      for (let j = 0; j < xfm.length; j++) {
        headings[j] = xfm[j].y1;
        for (let si = 0; si < numSpeeds; si++) rollMatrix[si][j] = xfm[j].rolls[si];
        for (let si = 0; si < numSpeeds; si++) rollMatrix[si].length = xfm.length;
      }
      // ─────────────────────────────────────────────────────────────────────────────

      console.log('=== PARSED DATA ===');
      console.log('Speeds:', speeds);
      console.log('Headings (Y1 transformed 0-360):', headings);
      console.log('Roll matrix (first row - speed 0):', rollMatrix[0]?.slice(0, 5).map(v => v.toFixed(2)));
      console.log('Roll statistics:', {
        totalPoints: numSpeeds * numHeadings,
        validPoints: rollCount,
        minRoll: isFinite(minRoll) ? minRoll.toFixed(2) : 'N/A',
        maxRoll: isFinite(maxRoll) ? maxRoll.toFixed(2) : 'N/A',
        averageRoll: rollCount > 0 ? (rollSum / rollCount).toFixed(2) : 'N/A'
      });

      // Extract fitted values from filename (Hs, Tz)
      const filenameMatch = filePath.match(/_H([\d.]+)_T([\d.]+)/);
      const fittedHs = filenameMatch ? parseFloat(filenameMatch[1]) : parameters.hs;
      const fittedTz = filenameMatch ? parseFloat(filenameMatch[2]) : parameters.tz;

      // Extract fitted GM from the folder name in the path (e.g. .../GM=1.5m/...)
      const gmFolderMatch = filePath.match(/GM[=_]?([\d.]+)/i);
      const fittedGM = gmFolderMatch ? parseFloat(gmFolderMatch[1]) : parameters.gm;

      console.log('Successfully loaded polar data:', { numSpeeds, numHeadings, speedCount: speeds.length, headingCount: headings.length });

      return {
        success: true,
        data: {
          speeds,
          headings,
          rollMatrix,
          numSpeeds,
          numHeadings: headings.length,
          numParameters: 0,
        },
        fittedGM: fittedGM,
        fittedHs: fittedHs,
        fittedTz: fittedTz,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading polar data:', errorMsg);
      console.error('File path:', filePath);
      console.error('Error details:', error);
      return {
        success: false,
        error: `Failed to parse polar data: ${errorMsg}`,
      };
    }
  }

  /**
   * Interpolate roll angle for given speed and heading
   */
  interpolateRollAngle(
    data: PolarData,
    speed: number,
    heading: number
  ): number {
    const { speeds, headings, rollMatrix } = data;

    // Find surrounding speed indices
    let speedIdx1 = 0,
      speedIdx2 = speeds.length - 1;
    for (let i = 0; i < speeds.length - 1; i++) {
      if (speed >= speeds[i] && speed <= speeds[i + 1]) {
        speedIdx1 = i;
        speedIdx2 = i + 1;
        break;
      }
    }

    // Find surrounding heading indices
    let headingIdx1 = 0,
      headingIdx2 = 0;
    let minDiff = 360;

    for (let i = 0; i < headings.length; i++) {
      let diff = Math.abs(headings[i] - heading);
      if (diff > 180) diff = 360 - diff;

      if (diff < minDiff) {
        minDiff = diff;
        headingIdx1 = i;
      }
    }

    // Find second nearest heading
    minDiff = 360;
    for (let i = 0; i < headings.length; i++) {
      if (i === headingIdx1) continue;

      let diff = Math.abs(headings[i] - heading);
      if (diff > 180) diff = 360 - diff;

      if (diff < minDiff) {
        minDiff = diff;
        headingIdx2 = i;
      }
    }

    // Bilinear interpolation
    const speedFactor =
      speeds[speedIdx2] > speeds[speedIdx1]
        ? (speed - speeds[speedIdx1]) / (speeds[speedIdx2] - speeds[speedIdx1])
        : 0;

    const v1 =
      rollMatrix[speedIdx1][headingIdx1] * (1 - speedFactor) +
      rollMatrix[speedIdx2][headingIdx1] * speedFactor;
    const v2 =
      rollMatrix[speedIdx1][headingIdx2] * (1 - speedFactor) +
      rollMatrix[speedIdx2][headingIdx2] * speedFactor;

    return (v1 + v2) / 2;
  }
}
