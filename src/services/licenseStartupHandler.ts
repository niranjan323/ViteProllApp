/**
 * License Startup Enforcer
 * Optional module to enforce license checking on app startup
 * Use this if you want to block app usage without a valid license
 */

import { licenseService } from './licenseService';

export interface LicenseStartupConfig {
  /**
   * Whether to enforce license check on startup
   * Set to true in production, false in development
   */
  enforceOnStartup: boolean;

  /**
   * Whether to show license dialog if no license is installed
   */
  showDialogIfMissing: boolean;

  /**
   * Whether to block app startup if license is invalid
   */
  blockIfInvalid: boolean;

  /**
   * Show warning banner if license expires within N days
   */
  warningThresholdDays: number;
}

const defaultConfig: LicenseStartupConfig = {
  enforceOnStartup: process.env.NODE_ENV === 'production',
  showDialogIfMissing: true,
  blockIfInvalid: process.env.NODE_ENV === 'production',
  warningThresholdDays: 30,
};

export class LicenseStartupHandler {
  private config: LicenseStartupConfig;
  private licenseStatus: {
    installed: boolean;
    valid: boolean;
    expiresIn?: number;
    reason?: string;
  } | null = null;

  constructor(config?: Partial<LicenseStartupConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Check license on app startup
   * Throws error if license is invalid and blocking is enabled
   */
  async checkOnStartup(): Promise<{
    canStartup: boolean;
    status: {
      installed: boolean;
      valid: boolean;
      expiresIn?: number;
      reason?: string;
      showDialog: boolean;
      blockApp: boolean;
      showWarning: boolean;
    };
  }> {
    try {
      if (!this.config.enforceOnStartup) {
        return {
          canStartup: true,
          status: {
            installed: true,
            valid: true,
            showDialog: false,
            blockApp: false,
            showWarning: false,
          },
        };
      }

      // Check license status
      const checkStatus = await licenseService.checkLicenseStatus();
      const validationResult = await licenseService.validateLicense();

      this.licenseStatus = {
        installed: checkStatus.installed,
        valid: validationResult.valid,
        expiresIn: validationResult.expiresIn,
        reason: validationResult.reason,
      };

      // Determine actions
      const showDialog = !checkStatus.installed && this.config.showDialogIfMissing;
      const blockApp = !validationResult.valid && this.config.blockIfInvalid;
      const showWarning =
        checkStatus.installed &&
        validationResult.expiresIn !== undefined &&
        validationResult.expiresIn < this.config.warningThresholdDays;

      return {
        canStartup: !blockApp,
        status: {
          installed: checkStatus.installed,
          valid: validationResult.valid,
          expiresIn: validationResult.expiresIn,
          reason: validationResult.reason,
          showDialog,
          blockApp,
          showWarning,
        },
      };
    } catch (error) {
      console.error('License startup check failed:', error);

      // In production, fail securely (block app)
      return {
        canStartup: !this.config.blockIfInvalid,
        status: {
          installed: false,
          valid: false,
          reason: `License check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          showDialog: this.config.showDialogIfMissing,
          blockApp: this.config.blockIfInvalid,
          showWarning: false,
        },
      };
    }
  }

  /**
   * Get current license status
   */
  getStatus() {
    return this.licenseStatus;
  }

  /**
   * Create a startup check component wrapper
   */
  static createStartupGuard(
    config?: Partial<LicenseStartupConfig>
  ): (Component: React.ComponentType<any>) => React.ComponentType<any> {
    return (Component: React.ComponentType<any>) => {
      return (props: any) => {
        const [startup, setStartup] = React.useState<any>(null);
        const [loading, setLoading] = React.useState(true);
        const [showDialog, setShowDialog] = React.useState(false);

        React.useEffect(() => {
          const checkLicense = async () => {
            const handler = new LicenseStartupHandler(config);
            const result = await handler.checkOnStartup();
            setStartup(result);
            setShowDialog(result.status.showDialog);
            setLoading(false);

            if (result.status.blockApp) {
              // Block app and show error
              console.error('License validation failed on startup');
            }
          };

          checkLicense();
        }, []);

        if (loading) {
          return <div>Checking license...</div>;
        }

        if (startup?.status.blockApp) {
          return (
            <div>
              <h1>License Required</h1>
              <p>{startup.status.reason}</p>
              <p>Please request a license to use this application.</p>
            </div>
          );
        }

        return (
          <>
            {startup?.status.showWarning && (
              <div style={{ padding: '12px', backgroundColor: '#fff3cd', color: '#856404' }}>
                ⏰ License expires in {startup.status.expiresIn} days. Please renew soon.
              </div>
            )}

            <Component {...props} licenseStartup={startup} />

            {/* License Dialog would be rendered by parent component */}
          </>
        );
      };
    };
  }
}

export default LicenseStartupHandler;
