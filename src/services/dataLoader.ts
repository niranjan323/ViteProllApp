import { FileSystemService } from './fileSystem';

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
  private fs: FileSystemService;

  constructor(fileSystemService: FileSystemService) {
    this.fs = fileSystemService;
  }

  /**
   * Load and parse the control file
   */
  async loadControlFile(controlFilePath: string): Promise<LoadControlFileResult> {
    try {
      const text = await this.fs.readTextFile(controlFilePath);

      // Parse control file - format: "values  !comment"
      // Lines:
      //   IMO_NUMBER        !Vessel IMO number
      //   MIN  MAX           !Min, Max Draft
      //   MIN  MAX           !Min, Max GM
      //   MIN  MAX           !Min, Max Speed
      //   MIN  MAX           !Min, Max Significant Wave Height (Hs)
      //   MIN  MAX           !Min, Max Wave Period
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // Helper: parse a line with "!comment" format, returning the values before "!"
      const parseLine = (line: string): string[] => {
        const dataPart = line.split('!')[0].trim();
        return dataPart.split(/\s+/).filter(s => s.length > 0);
      };

      // Helper: find a line by comment keyword (case-insensitive)
      // Searches for keyword anywhere in the comment part after "!"
      const findLineByComment = (keyword: string): string | undefined => {
        return lines.find(l => {
          const bangIndex = l.indexOf('!');
          if (bangIndex === -1) return false;
          const commentPart = l.substring(bangIndex + 1).toLowerCase();
          return commentPart.includes(keyword.toLowerCase());
        });
      };

      // Parse IMO
      const imoLine = findLineByComment('imo') || findLineByComment('vessel');
      const imoValues = imoLine ? parseLine(imoLine) : [];

      const vesselInfo: VesselInfo = {
        imo: imoValues[0] || 'Unknown',
        name: 'Unknown',
      };

      // Parse Draft bounds
      const draftLine = findLineByComment('draft');
      const draftValues = draftLine ? parseLine(draftLine) : [];

      // Parse GM bounds
      const gmLine = findLineByComment('gm');
      const gmValues = gmLine ? parseLine(gmLine) : [];

      // Parse Speed bounds
      const speedLine = findLineByComment('speed');
      const speedValues = speedLine ? parseLine(speedLine) : [];

      // Parse Allowed Roll bounds
      const rollLine = findLineByComment('allowed roll') || findLineByComment('roll');
      const rollValues = rollLine ? parseLine(rollLine) : [];

      // Parse Hs bounds
      const hsLine = findLineByComment('wave height') || findLineByComment('hs');
      const hsValues = hsLine ? parseLine(hsLine) : [];

      // Parse Wave Period (Tz) bounds
      const tzLine = findLineByComment('wave period');
      const tzValues = tzLine ? parseLine(tzLine) : [];

      const parameterBounds: ParameterBounds = {
        draftLower: parseFloat(draftValues[0] || '0'),
        draftUpper: parseFloat(draftValues[1] || '50'),
        gmLower: parseFloat(gmValues[0] || '0.5'),
        gmUpper: parseFloat(gmValues[1] || '5.0'),
        speedLower: parseFloat(speedValues[0] || '0'),
        speedUpper: parseFloat(speedValues[1] || '30'),
        rollLower: parseFloat(rollValues[0] || '0'),
        rollUpper: parseFloat(rollValues[1] || '60'),
        hsLower: parseFloat(hsValues[0] || '3.0'),
        hsUpper: parseFloat(hsValues[1] || '12.0'),
        tzLower: parseFloat(tzValues[0] || '5.0'),
        tzUpper: parseFloat(tzValues[1] || '18.0'),
      };

      // Try to parse representative drafts if present (Td, Ti, Ts lines)
      // Strategy 1: comment-based format  "10.5  !Ts - Scantling draft"
      const tdLine = findLineByComment('td') || findLineByComment('design draft');
      const tiLine = findLineByComment('ti') || findLineByComment('intermediate');
      const tsLine = findLineByComment('ts') || findLineByComment('scantling');

      // Strategy 2: key=value format  "Td=10.0" or "Td = 10.0"
      const findKeyValue = (key: string): number | null => {
        const re = new RegExp(`^${key}\\s*=\\s*([\\d.]+)`, 'i');
        for (const l of lines) {
          const m = l.match(re);
          if (m) return parseFloat(m[1]);
        }
        return null;
      };

      const representativeDrafts: RepresentativeDrafts = {
        design: tdLine
          ? parseFloat(parseLine(tdLine)[0] || '0')
          : (findKeyValue('td') ?? findKeyValue('design') ?? 0),
        intermediate: tiLine
          ? parseFloat(parseLine(tiLine)[0] || '0')
          : (findKeyValue('ti') ?? findKeyValue('intermediate') ?? 0),
        scantling: tsLine
          ? parseFloat(parseLine(tsLine)[0] || '0')
          : (findKeyValue('ts') ?? findKeyValue('scantling') ?? 0),
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
    draftLower?: number;  // from parameterBounds, used for old-style folder mapping
    draftUpper?: number;
  }): Promise<FindDataFileResult> {
    try {
      console.log('Looking for files with parameters:', parameters);

      // 1st search: Find closest draft folder in the root of the selected folder
      // Filter out files (entries with extensions like .ctl)
      const rootEntries = await this.fs.listDirectory('');
      const draftCandidates = rootEntries.filter(e => !e.includes('.'));
      console.log('Draft folder candidates:', draftCandidates);

      // Try numeric matching first (new-style: Draft=11m)
      let draftFolder = this.findClosestMatch(draftCandidates, parameters.draft, 'Draft');

      if (!draftFolder) {
        // Fall back to old-style names: design / intermediate / scantling
        // Map them to numeric values using draft bounds from the control file
        const lower = parameters.draftLower ?? 11;
        const upper = parameters.draftUpper ?? 16;
        const mid = (lower + upper) / 2;

        const oldStyleMap: Record<string, number> = {
          design: lower,
          intermediate: mid,
          scantling: upper,
        };

        let minDiff = Infinity;
        for (const candidate of draftCandidates) {
          const mappedValue = oldStyleMap[candidate.toLowerCase()];
          if (mappedValue === undefined) continue;
          const diff = Math.abs(mappedValue - parameters.draft);
          if (diff < minDiff) {
            minDiff = diff;
            draftFolder = candidate;
          }
        }
      }

      console.log('Selected draft folder:', draftFolder);

      if (!draftFolder) {
        return { success: false, error: 'No matching draft folder found' };
      }

      // Extract the numeric draft value from the folder name (e.g. "Draft=11m" → 11)
      // For old-style names, use the mapped value
      const draftNumMatch = draftFolder.match(/[\d.]+/);
      const lower = parameters.draftLower ?? 11;
      const upper = parameters.draftUpper ?? 16;
      const oldStyleValues: Record<string, number> = {
        design: lower, intermediate: (lower + upper) / 2, scantling: upper,
      };
      const fittedDraft = draftNumMatch
        ? parseFloat(draftNumMatch[0])
        : (oldStyleValues[draftFolder.toLowerCase()] ?? parameters.draft);

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
   */
  private findClosestMatch(folders: string[], targetValue: number, _prefix: string): string | null {
    let closest: string | null = null;
    let minDiff = Infinity;

    for (const folder of folders) {
      // Extract numeric value from folder name (e.g., "GM=1.5m" -> 1.5)
      const match = folder.match(/[\d.]+/);
      if (!match) continue;

      const value = parseFloat(match[0]);
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

      console.log('=== PARSED DATA ===');
      console.log('Speeds:', speeds);
      console.log('Headings:', headings);
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
          numHeadings,
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
