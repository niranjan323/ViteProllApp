import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { generateMachineId, validateMachineBinding } from './machineIdentifier';

/**
 * Complete License Management System
 * Handles generation, validation, and storage of licenses
 */

export interface LicenseRequestData {
  machineId: string;
  appName: string;
  appVersion: string;
  timestamp: string;
  contactEmail?: string;
  organizationName?: string;
}

export interface License {
  licenseKey: string;
  machineId: string;
  appName: string;
  appVersion: string;
  issuedDate: string;
  expiryDate: string;
  features: string[];
  signature: string;
  metadata?: { [key: string]: string };
}

export interface LicenseValidationResult {
  valid: boolean;
  reason?: string;
  license?: License;
  expiresIn?: number; // days
}

// Configuration
const LICENSE_DIR = path.join(app.getPath('userData'), 'licenses');
const LICENSE_FILE = path.join(LICENSE_DIR, 'license.json');
const REQUEST_DIR = path.join(app.getPath('userData'), 'license-requests');
const APP_NAME = 'PPROLL';
const CURRENT_VERSION = '1.0.0'; // Move this to a config file eventually
const LICENSE_VALIDITY_DAYS = 365;

/**
 * Ensures license directories exist
 */
function ensureLicenseDirs(): void {
  [LICENSE_DIR, REQUEST_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Generates a license request XML file
 * This file is sent to the licensing server/email
 */
export function generateLicenseRequest(
  contactEmail?: string,
  organizationName?: string
): { xmlContent: string; filePath: string } {
  ensureLicenseDirs();

  const machineId = generateMachineId();
  const timestamp = new Date().toISOString();

  const requestData: LicenseRequestData = {
    machineId,
    appName: APP_NAME,
    appVersion: CURRENT_VERSION,
    timestamp,
    contactEmail: contactEmail || 'user@example.com',
    organizationName: organizationName || 'Unknown',
  };

  // Generate XML
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<LicenseRequest>
  <RequestId>${crypto.randomBytes(16).toString('hex').toUpperCase()}</RequestId>
  <Timestamp>${timestamp}</Timestamp>
  <Application>
    <Name>${requestData.appName}</Name>
    <Version>${requestData.appVersion}</Version>
  </Application>
  <Machine>
    <MachineId>${machineId}</MachineId>
    <Hostname>${require('os').hostname()}</Hostname>
    <Platform>${process.platform}</Platform>
  </Machine>
  <Contact>
    <Email>${requestData.contactEmail}</Email>
    <Organization>${requestData.organizationName}</Organization>
  </Contact>
</LicenseRequest>`;

  // Save request locally for record-keeping
  const filename = `license-request-${Date.now()}.xml`;
  const filePath = path.join(REQUEST_DIR, filename);
  fs.writeFileSync(filePath, xmlContent, 'utf-8');

  console.log(`License request generated: ${filePath}`);

  return { xmlContent, filePath };
}

/**
 * Creates a license file from server data
 * In production, this would be created by a licensing server
 * For now, this demonstrates the expected structure
 */
export function createLicenseFromServerData(
  licenseData: Partial<License>,
  secretKey: string // Shared secret with server
): License {
  const license: License = {
    licenseKey: licenseData.licenseKey || `KEY-${crypto.randomBytes(16).toString('hex').toUpperCase()}`,
    machineId: licenseData.machineId || generateMachineId(),
    appName: licenseData.appName || APP_NAME,
    appVersion: licenseData.appVersion || CURRENT_VERSION,
    issuedDate: licenseData.issuedDate || new Date().toISOString(),
    expiryDate:
      licenseData.expiryDate ||
      new Date(Date.now() + LICENSE_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    features: licenseData.features || [
      'vessel-analysis',
      'polar-diagram',
      'report-generation',
    ],
    signature: '',
    metadata: licenseData.metadata || {},
  };

  // Generate signature (in production, use asymmetric encryption)
  const signatureData = `${license.machineId}${license.appName}${license.appVersion}${license.expiryDate}`;
  license.signature = crypto
    .createHmac('sha256', secretKey)
    .update(signatureData)
    .digest('hex');

  return license;
}

/**
 * Saves license file to AppData
 */
export function saveLicense(license: License): boolean {
  try {
    ensureLicenseDirs();
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(license, null, 2), 'utf-8');
    // Restrict file permissions (Windows)
    fs.chmodSync(LICENSE_FILE, 0o400); // Read-only for owner
    console.log(`License saved: ${LICENSE_FILE}`);
    return true;
  } catch (error) {
    console.error('Failed to save license:', error);
    return false;
  }
}

/**
 * Loads license from AppData
 */
export function loadLicense(): License | null {
  try {
    if (!fs.existsSync(LICENSE_FILE)) {
      return null;
    }
    const data = fs.readFileSync(LICENSE_FILE, 'utf-8');
    return JSON.parse(data) as License;
  } catch (error) {
    console.error('Failed to load license:', error);
    return null;
  }
}

/**
 * Removes the license file (for uninstall or re-licensing)
 */
export function removeLicense(): boolean {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      // Change permissions back before deletion
      fs.chmodSync(LICENSE_FILE, 0o644);
      fs.unlinkSync(LICENSE_FILE);
      console.log('License removed');
      return true;
    }
    return true;
  } catch (error) {
    console.error('Failed to remove license:', error);
    return false;
  }
}

/**
 * Validates a license for:
 * - Machine binding
 * - Expiry date
 * - Version compatibility
 * - Signature integrity
 */
export function validateLicense(
  secretKey: string,
  license?: License | null
): LicenseValidationResult {
  try {
    // Load license if not provided
    const licenseToValidate = license || loadLicense();

    if (!licenseToValidate) {
      return {
        valid: false,
        reason: 'No license found. Please install a valid license.',
      };
    }

    // 1. Validate machine binding
    if (!validateMachineBinding(licenseToValidate.machineId)) {
      return {
        valid: false,
        reason: 'License is not valid for this machine.',
      };
    }

    // 2. Validate expiry date
    const expiryDate = new Date(licenseToValidate.expiryDate);
    const now = new Date();

    if (now > expiryDate) {
      return {
        valid: false,
        reason: `License expired on ${expiryDate.toLocaleDateString()}`,
      };
    }

    // 3. Validate version compatibility
    // In production, implement semantic versioning check
    if (licenseToValidate.appVersion !== CURRENT_VERSION) {
      console.warn(
        `Version mismatch: License for v${licenseToValidate.appVersion}, App is v${CURRENT_VERSION}`
      );
      // Still allow usage but warn (or implement strict version checking)
    }

    // 4. Validate signature
    const signatureData = `${licenseToValidate.machineId}${licenseToValidate.appName}${licenseToValidate.appVersion}${licenseToValidate.expiryDate}`;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(signatureData)
      .digest('hex');

    if (licenseToValidate.signature !== expectedSignature) {
      return {
        valid: false,
        reason: 'License signature validation failed. License may be corrupted or tampered.',
      };
    }

    // 5. Calculate days until expiry
    const expiresIn = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      valid: true,
      license: licenseToValidate,
      expiresIn,
    };
  } catch (error) {
    console.error('License validation error:', error);
    return {
      valid: false,
      reason: `Validation error: ${(error as Error).message}`,
    };
  }
}

/**
 * Gets license info without sensitive data
 */
export function getLicenseInfo(): { installed: boolean; expiresIn?: number; machineId: string } {
  const license = loadLicense();
  const machineId = generateMachineId();

  if (!license) {
    return { installed: false, machineId };
  }

  const expiryDate = new Date(license.expiryDate);
  const now = new Date();
  const expiresIn = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    installed: true,
    expiresIn: expiresIn > 0 ? expiresIn : 0,
    machineId,
  };
}

/**
 * Gets license request file path for sending via email
 */
export function getLicenseRequestPath(): string | null {
  try {
    ensureLicenseDirs();
    // Return the most recent request
    const files = fs
      .readdirSync(REQUEST_DIR)
      .filter((f) => f.endsWith('.xml'))
      .map((f) => ({
        name: f,
        path: path.join(REQUEST_DIR, f),
        time: fs.statSync(path.join(REQUEST_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    return files.length > 0 ? files[0].path : null;
  } catch (error) {
    console.error('Failed to get license request:', error);
    return null;
  }
}

/**
 * Lists all saved licenses and requests (for debugging)
 */
export function getLicenseHistory(): {
  licenses: string[];
  requests: string[];
  licenseDir: string;
  requestDir: string;
} {
  ensureLicenseDirs();

  const licenses = fs.existsSync(LICENSE_DIR)
    ? fs.readdirSync(LICENSE_DIR)
    : [];
  const requests = fs.existsSync(REQUEST_DIR)
    ? fs.readdirSync(REQUEST_DIR)
    : [];

  return {
    licenses,
    requests,
    licenseDir: LICENSE_DIR,
    requestDir: REQUEST_DIR,
  };
}
