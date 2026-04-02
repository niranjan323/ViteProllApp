import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Generates a unique machine identifier based on hardware information
 * This identifier is used to bind licenses to specific devices
 */

export interface MachineInfo {
  machineId: string;
  hostname: string;
  platform: string;
  cpuModel: string;
  totalMemory: number;
  macAddresses: string[];
  generatedAt: string;
}

/**
 * Generates a hardware-based machine identifier
 * Combines: Hostname + CPU Model + Total Memory + Primary MAC Address
 */
export function generateMachineId(): string {
  const hostname = os.hostname();
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown';
  const totalMemory = os.totalmem();
  const interfaces = os.networkInterfaces();

  // Get primary MAC address (first available)
  let macAddress = 'unknown';
  for (const [, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue;
    for (const addr of addresses) {
      if (addr.family === 'IPv4' && !addr.internal) {
        macAddress = addr.mac;
        break;
      }
    }
    if (macAddress !== 'unknown') break;
  }

  // Combine hardware identifiers
  const hardwareString = `${hostname}-${cpuModel}-${totalMemory}-${macAddress}`;

  // Generate SHA256 hash for consistent, non-reversible ID
  const machineId = crypto
    .createHash('sha256')
    .update(hardwareString)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();

  return machineId;
}

/**
 * Gets detailed machine information
 */
export function getMachineInfo(): MachineInfo {
  const macAddresses: string[] = [];
  const interfaces = os.networkInterfaces();

  for (const [, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue;
    for (const addr of addresses) {
      if (addr.family === 'IPv4') {
        macAddresses.push(addr.mac);
      }
    }
  }

  return {
    machineId: generateMachineId(),
    hostname: os.hostname(),
    platform: os.platform(),
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    totalMemory: os.totalmem(),
    macAddresses: [...new Set(macAddresses)], // Remove duplicates
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Validates that a license is bound to the current machine
 */
export function validateMachineBinding(licenseMachineId: string): boolean {
  const currentMachineId = generateMachineId();
  return currentMachineId === licenseMachineId;
}
