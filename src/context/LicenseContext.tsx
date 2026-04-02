import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { licenseService } from '../services/licenseService';

/**
 * License Context
 * Provides global license state to the entire application
 */

export interface LicenseContextType {
  isLicensed: boolean;
  expiresIn: number | undefined;
  machineId: string;
  loading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  openLicenseDialog: () => void;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

interface LicenseContextProviderProps {
  children: ReactNode;
  onOpenLicenseDialog?: () => void;
}

/**
 * License Context Provider
 * Wrap your app with this to provide license state globally
 */
export const LicenseContextProvider: React.FC<LicenseContextProviderProps> = ({
  children,
  onOpenLicenseDialog,
}) => {
  const [isLicensed, setIsLicensed] = useState(true);
  const [expiresIn, setExpiresIn] = useState<number | undefined>();
  const [machineId, setMachineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check license status on mount and periodically
  useEffect(() => {
    const checkLicense = async () => {
      try {
        setLoading(true);
        setError(null);

        const status = await licenseService.checkLicenseStatus();

        setIsLicensed(status.installed);
        setExpiresIn(status.expiresIn);
        setMachineId(status.machineId);

        // Warn if license expires soon
        if (status.installed && status.expiresIn && status.expiresIn <= 30) {
          console.warn(`License expires in ${status.expiresIn} days`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to check license';
        setError(errorMsg);
        console.error('License check error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkLicense();

    // Check license status every hour
    const interval = setInterval(checkLicense, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const refreshStatus = async () => {
    try {
      setLoading(true);
      const status = await licenseService.checkLicenseStatus();
      setIsLicensed(status.installed);
      setExpiresIn(status.expiresIn);
      setMachineId(status.machineId);
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to refresh license status';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const contextValue: LicenseContextType = {
    isLicensed,
    expiresIn,
    machineId,
    loading,
    error,
    refreshStatus,
    openLicenseDialog: onOpenLicenseDialog || (() => {}),
  };

  return (
    <LicenseContext.Provider value={contextValue}>
      {children}
    </LicenseContext.Provider>
  );
};

/**
 * Hook to use license context
 */
export const useLicense = (): LicenseContextType => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within LicenseContextProvider');
  }
  return context;
};

/**
 * License Status Badge Component
 * Shows quick license status
 */
export const LicenseStatusBadge: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const { isLicensed, expiresIn, loading } = useLicense();

  const getStatusColor = () => {
    if (loading) return 'default';
    if (!isLicensed) return 'error';
    if (expiresIn && expiresIn <= 30) return 'warning';
    return 'success';
  };

  const getStatusText = () => {
    if (loading) return 'Checking...';
    if (!isLicensed) return '⚠ No License';
    if (expiresIn && expiresIn <= 30) return `⏰ ${expiresIn}d left`;
    return '✓ Licensed';
  };

  return (
    <div
      style={{
        padding: '4px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 'bold',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: getStatusColor() === 'error' ? '#f44336' : 
                         getStatusColor() === 'warning' ? '#ff9800' : 
                         '#4caf50',
        color: 'white',
      }}
      onClick={onClick}
    >
      {getStatusText()}
    </div>
  );
};
