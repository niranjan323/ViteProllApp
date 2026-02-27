import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { FileSystemService } from '../services/fileSystem';
import { DataLoader } from '../services/dataLoader';
import type { VesselInfo, ParameterBounds, RepresentativeDrafts } from '../services/dataLoader';
import { PolarCalculations } from '../services/polarCalculations';

/**
 * Electron Context
 * Provides access to file system, data loading, and calculation services
 */

interface ElectronContextType {
  fileSystem: FileSystemService;
  dataLoader: DataLoader;
  polarCalculations: typeof PolarCalculations;
  selectedFolder: string | null;
  controlFilePath: string | null;
  vesselInfo: VesselInfo | null;
  parameterBounds: ParameterBounds | null;
  representativeDrafts: RepresentativeDrafts | null;
  selectFolder: () => Promise<boolean>;
  selectControlFile: () => Promise<boolean>;
  loadControlFile: (controlPath: string) => Promise<boolean>;
  resetAll: () => void;
  isReady: boolean;
}

const ElectronContext = createContext<ElectronContextType | undefined>(undefined);

export const ElectronProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fileSystem] = useState(() => new FileSystemService());
  const [dataLoader] = useState(() => new DataLoader(fileSystem));
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [controlFilePath, setControlFilePath] = useState<string | null>(null);
  const [vesselInfo, setVesselInfo] = useState<VesselInfo | null>(null);
  const [parameterBounds, setParameterBounds] = useState<ParameterBounds | null>(null);
  const [representativeDrafts, setRepresentativeDrafts] = useState<RepresentativeDrafts | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Check if Electron API is available
  useEffect(() => {
    if (window.electronAPI) {
      setIsReady(true);
    }
  }, []);

  /**
   * User selects a folder containing polar data
   */
  const selectFolder = async (): Promise<boolean> => {
    try {
      const result = await fileSystem.selectFolder();

      if (!result.success) {
        console.error('Folder selection error:', result.error);
        return false;
      }

      if (result.canceled) {
        console.log('Folder selection canceled');
        return false;
      }

      const folderPath = result.folderPath!;
      fileSystem.setBasePath(folderPath);
      setSelectedFolder(folderPath);
      console.log('Folder selected:', folderPath);

      return true;
    } catch (error) {
      console.error('Error selecting folder:', error);
      return false;
    }
  };

  /**
   * User selects a control file
   */
  const selectControlFile = async (): Promise<boolean> => {
    try {
      console.log('selectControlFile called from ElectronContext');
      const startPath = selectedFolder ? `${selectedFolder}/PolarData` : undefined;
      console.log('startPath:', startPath);
      
      const result = await fileSystem.selectControlFile(startPath);
      console.log('fileSystem.selectControlFile result:', result);

      if (!result.success) {
        console.error('Control file selection error:', result.error);
        return false;
      }

      if (result.canceled) {
        console.log('Control file selection canceled');
        return false;
      }

      const filePath = result.filePath!;
      setControlFilePath(filePath);
      console.log('Control file selected:', filePath);

      // Attempt to load the control file
      return loadControlFile(filePath);
    } catch (error) {
      console.error('Error selecting control file:', error);
      return false;
    }
  };

  /**
   * Reset all state to initial values
   */
  const resetAll = () => {
    setSelectedFolder(null);
    setControlFilePath(null);
    setVesselInfo(null);
    setParameterBounds(null);
    setRepresentativeDrafts(null);
    fileSystem.setBasePath('');
  };

  /**
   * Load and parse the control file
   */
  const loadControlFile = async (controlPath: string): Promise<boolean> => {
    try {
      const result = await dataLoader.loadControlFile(controlPath);

      if (!result.success) {
        console.error('Control file loading error:', result.error);
        return false;
      }

      setVesselInfo(result.vesselInfo || null);
      setParameterBounds(result.parameterBounds || null);
      setRepresentativeDrafts(result.representativeDrafts || null);
      setControlFilePath(controlPath);

      console.log('Control file loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading control file:', error);
      return false;
    }
  };

  const value: ElectronContextType = {
    fileSystem,
    dataLoader,
    polarCalculations: PolarCalculations,
    selectedFolder,
    controlFilePath,
    vesselInfo,
    parameterBounds,
    representativeDrafts,
    selectFolder,
    selectControlFile,
    loadControlFile,
    resetAll,
    isReady,
  };

  return <ElectronContext.Provider value={value}>{children}</ElectronContext.Provider>;
};

/**
 * Hook to use the Electron context
 */
export const useElectron = (): ElectronContextType => {
  const context = useContext(ElectronContext);
  if (!context) {
    throw new Error('useElectron must be used within an ElectronProvider');
  }
  return context;
};
