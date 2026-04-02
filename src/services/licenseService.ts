/**
 * Frontend License Service
 * Wrapper around Electron IPC APIs for easier use in React components
 */

interface LicenseInfo {
  installed: boolean;
  expiresIn?: number;
  machineId: string;
}

interface MachineInfo {
  machineId: string;
  hostname: string;
  platform: string;
}

class LicenseService {
  /**
   * Check if a license is currently installed
   */
  async checkLicenseStatus(): Promise<LicenseInfo> {
    try {
      const result = await (window as any).electronAPI.license.getStatus();
      if (!result.success) {
        throw new Error(result.error || 'Failed to get license status');
      }
      return {
        installed: result.installed || false,
        expiresIn: result.expiresIn,
        machineId: result.machineId || '',
      };
    } catch (error) {
      console.error('License status check failed:', error);
      throw error;
    }
  }

  /**
   * Generate a new license request
   */
  async generateLicenseRequest(
    contactEmail: string,
    organizationName: string
  ): Promise<{ xmlContent: string; filePath: string; machineId: string }> {
    try {
      const result = await (window as any).electronAPI.license.generateRequest(
        contactEmail,
        organizationName
      );
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate request');
      }
      return {
        xmlContent: result.xmlContent || '',
        filePath: result.filePath || '',
        machineId: result.machineId || '',
      };
    } catch (error) {
      console.error('Failed to generate license request:', error);
      throw error;
    }
  }

  /**
   * Get machine information
   */
  async getMachineInfo(): Promise<MachineInfo> {
    try {
      const result = await (window as any).electronAPI.license.getMachineInfo();
      if (!result.success) {
        throw new Error(result.error || 'Failed to get machine info');
      }
      return {
        machineId: result.machineId || '',
        hostname: result.hostname || '',
        platform: result.platform || '',
      };
    } catch (error) {
      console.error('Failed to get machine info:', error);
      throw error;
    }
  }

  /**
   * Validate current license
   */
  async validateLicense(): Promise<{ valid: boolean; reason?: string; expiresIn?: number }> {
    try {
      const result = await (window as any).electronAPI.license.validate();
      if (!result.success) {
        return {
          valid: false,
          reason: result.reason || 'License validation failed',
        };
      }
      return {
        valid: result.valid || false,
        reason: result.reason,
        expiresIn: result.expiresIn,
      };
    } catch (error) {
      console.error('License validation error:', error);
      return {
        valid: false,
        reason: 'Failed to validate license',
      };
    }
  }

  /**
   * Install a new license
   */
  async installLicense(licenseContent: string): Promise<{ success: boolean; message: string; expiresIn?: number }> {
    try {
      const result = await (window as any).electronAPI.license.install(licenseContent);
      return {
        success: result.success,
        message: result.message || (result.success ? 'License installed' : result.error || 'Installation failed'),
        expiresIn: result.expiresIn,
      };
    } catch (error) {
      console.error('License installation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to install license',
      };
    }
  }

  /**
   * Remove current license
   */
  async removeLicense(): Promise<boolean> {
    try {
      const result = await (window as any).electronAPI.license.remove();
      return result.success;
    } catch (error) {
      console.error('Failed to remove license:', error);
      return false;
    }
  }

  /**
   * Open email client with license request
   */
  async openEmailClient(recipient?: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await (window as any).electronAPI.license.openEmail(recipient);
      return {
        success: result.success,
        message: result.message || result.error || 'Email client opened',
      };
    } catch (error) {
      console.error('Failed to open email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to open email client',
      };
    }
  }

  /**
   * Open license request folder
   */
  async openRequestFolder(folderPath?: string): Promise<boolean> {
    try {
      const result = await (window as any).electronAPI.license.openFolder(folderPath);
      return result.success;
    } catch (error) {
      console.error('Failed to open folder:', error);
      return false;
    }
  }

  /**
   * Select and load a license file
   */
  async selectLicenseFile(): Promise<{ base64Content: string; fileName: string } | null> {
    try {
      const result = await (window as any).electronAPI.license.selectFile();
      if (result.canceled) {
        return null;
      }
      if (!result.success) {
        throw new Error(result.error || 'Failed to select file');
      }
      return {
        base64Content: result.base64Content || '',
        fileName: result.fileName || '',
      };
    } catch (error) {
      console.error('Failed to select license file:', error);
      throw error;
    }
  }

  /**
   * Get license request template
   */
  async getLicenseHistory(): Promise<any> {
    try {
      const result = await (window as any).electronAPI.license.getHistory();
      if (!result.success) {
        throw new Error(result.error || 'Failed to get history');
      }
      return {
        licenses: result.licenses || [],
        requests: result.requests || [],
        licenseDir: result.licenseDir,
        requestDir: result.requestDir,
      };
    } catch (error) {
      console.error('Failed to get license history:', error);
      throw error;
    }
  }
}

export const licenseService = new LicenseService();
export default LicenseService;
