import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { FileSystemService } from '../services/fileSystem';
import { WebFileSystemService } from '../services/webFileSystem';
import { ApiFileSystemService } from '../services/apiFileService';
import type { IFileSystemService } from '../services/IFileSystemService';
import { DataLoader } from '../services/dataLoader';
import type { VesselInfo, ParameterBounds, RepresentativeDrafts } from '../services/dataLoader';
import { PolarCalculations } from '../services/polarCalculations';

/**
 * Runtime detection — true when running inside Electron desktop app.
 * In web/browser mode window.electronAPI is undefined.
 */
const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

/**
 * Electron Context
 * Provides access to file system, data loading, and calculation services.
 * Works in both Electron (desktop) and web (browser) modes.
 */

interface ElectronContextType {
  fileSystem: IFileSystemService;
  dataLoader: DataLoader;
  polarCalculations: typeof PolarCalculations;
  selectedFolder: string | null;
  controlFilePath: string | null;
  vesselInfo: VesselInfo | null;
  parameterBounds: ParameterBounds | null;
  representativeDrafts: RepresentativeDrafts | null;
  isElectronMode: boolean;
  selectFolder: () => Promise<boolean>;
  /** Web mode only — set the active blob project by name, then load its control file. */
  selectProject: (projectName: string) => Promise<boolean>;
  selectControlFile: () => Promise<boolean>;
  loadControlFile: (controlPath: string) => Promise<{ success: boolean; error?: string }>;
  resetAll: () => void;
  isReady: boolean;
}

const ElectronContext = createContext<ElectronContextType | undefined>(undefined);

export const ElectronProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fileSystem] = useState<IFileSystemService>(() => {
    if (isElectron) return new FileSystemService();
    // Web mode: use API-backed file system (Blob Storage via CRoll .NET API)
    // Falls back to WebFileSystemService (File System Access API) only if API URL is not set
    return import.meta.env.VITE_API_BASE_URL
      ? new ApiFileSystemService()
      : new WebFileSystemService();
  });
  const [dataLoader] = useState(() => new DataLoader(fileSystem));
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [controlFilePath, setControlFilePath] = useState<string | null>(null);
  const [vesselInfo, setVesselInfo] = useState<VesselInfo | null>(null);
  const [parameterBounds, setParameterBounds] = useState<ParameterBounds | null>(null);
  const [representativeDrafts, setRepresentativeDrafts] = useState<RepresentativeDrafts | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Always ready. In Electron: restore last-used folder from localStorage.
  // In web: FileSystemDirectoryHandle cannot be persisted — user re-selects each session.
  useEffect(() => {
    setIsReady(true);
    if (isElectron) {
      const savedFolder = localStorage.getItem('vesselDataFolder');
      if (savedFolder) {
        fileSystem.setBasePath(savedFolder);
        setSelectedFolder(savedFolder);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Web mode only — set the active project by blob project name, then auto-load control file.
   * Called by the ProjectSelector UI component after fetching available projects.
   */
  const selectProject = async (projectName: string): Promise<boolean> => {
    try {
      fileSystem.setBasePath(projectName);
      setSelectedFolder(projectName);
      const result = await fileSystem.selectControlFile();
      if (!result.success) {
        console.error('No control file found for project:', projectName, result.error);
        return false;
      }
      return (await loadControlFile(result.filePath!)).success;
    } catch (error) {
      console.error('Error selecting project:', error);
      return false;
    }
  };

  /**
   * User selects a folder containing polar data (Electron / native folder picker)
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
      // Only persist in Electron — web cannot restore a FileSystemDirectoryHandle
      if (isElectron) {
        localStorage.setItem('vesselDataFolder', folderPath);
      }
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
      const startPath = selectedFolder ? `${selectedFolder}/PolarData` : undefined;
      const result = await fileSystem.selectControlFile(startPath);

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

      const loadResult = await loadControlFile(filePath);
      return loadResult.success;
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
  const loadControlFile = async (controlPath: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await dataLoader.loadControlFile(controlPath);

      if (!result.success) {
        console.error('Control file loading error:', result.error);
        return { success: false, error: result.error };
      }

      setVesselInfo(result.vesselInfo || null);
      setParameterBounds(result.parameterBounds || null);
      setRepresentativeDrafts(result.representativeDrafts || null);
      setControlFilePath(controlPath);

      console.log('Control file loaded successfully');
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error loading control file';
      console.error('Error loading control file:', error);
      return { success: false, error: errorMsg };
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
    isElectronMode: isElectron,
    selectFolder,
    selectProject,
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
