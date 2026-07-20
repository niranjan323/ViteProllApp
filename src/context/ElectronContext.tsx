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

interface ElectronContextType {
  fileSystem: IFileSystemService;
  dataLoader: DataLoader;
  polarCalculations: typeof PolarCalculations;
  selectedFolder: string | null;
  controlFilePath: string | null;
  vesselInfo: VesselInfo | null;
  parameterBounds: ParameterBounds | null;
  representativeDrafts: RepresentativeDrafts | null;
  artStatus: 0 | 1;
  artMode: 'standard' | 'art';
  setArtMode: (mode: 'standard' | 'art') => void;
  isElectronMode: boolean;
  selectFolder: () => Promise<boolean>;
  /** Web mode only — set the active blob project by name, then load its control file. */
  selectProject: (projectName: string, isOwned?: boolean) => Promise<{ success: boolean; error?: string }>;
  /** Web mode only — set the userId used to scope file operations to user-uploaded projects. */
  setApiUserId: (userId: string) => void;
  selectControlFile: () => Promise<boolean>;
  loadControlFile: (controlPath: string) => Promise<{ success: boolean; error?: string; artStatus?: 0 | 1 }>;
  resetAll: () => void;
  isReady: boolean;
}

const ElectronContext = createContext<ElectronContextType | undefined>(undefined);

export const ElectronProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fileSystem] = useState<IFileSystemService>(() => {
    if (isElectron) return new FileSystemService();
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
  const [artStatus, setArtStatus] = useState<0 | 1>(0);
  const [artMode, setArtMode] = useState<'standard' | 'art'>('standard');
  const [isReady, setIsReady] = useState(false);
  const [apiUserId, setApiUserId] = useState('');

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
   * Returns the error string so the caller can display it to the user.
   */
  const selectProject = async (projectName: string, isOwned?: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      fileSystem.setBasePath(projectName);
      if (fileSystem instanceof ApiFileSystemService) {
        fileSystem.setUserId(apiUserId);
        fileSystem.setIsOwned(isOwned ?? false);
      }
      setSelectedFolder(projectName);

      const ctlResult = await fileSystem.selectControlFile();
      if (!ctlResult.success) {
        return { success: false, error: ctlResult.error ?? 'Control file not found.' };
      }

      return loadControlFile(ctlResult.filePath!);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error loading project';
      console.error('Error selecting project:', error);
      return { success: false, error: msg };
    }
  };

  const selectFolder = async (): Promise<boolean> => {
    try {
      const result = await fileSystem.selectFolder();

      if (!result.success) {
        console.error('Folder selection error:', result.error);
        return false;
      }

      if (result.canceled) return false;

      const folderPath = result.folderPath!;
      fileSystem.setBasePath(folderPath);
      setSelectedFolder(folderPath);
      if (isElectron) {
        localStorage.setItem('vesselDataFolder', folderPath);
      }

      return true;
    } catch (error) {
      console.error('Error selecting folder:', error);
      return false;
    }
  };

  const selectControlFile = async (): Promise<boolean> => {
    try {
      const startPath = selectedFolder ? `${selectedFolder}/PolarData` : undefined;
      const result = await fileSystem.selectControlFile(startPath);

      if (!result.success) {
        console.error('Control file selection error:', result.error);
        return false;
      }

      if (result.canceled) return false;

      const filePath = result.filePath!;
      setControlFilePath(filePath);

      const loadResult = await loadControlFile(filePath);
      return loadResult.success;
    } catch (error) {
      console.error('Error selecting control file:', error);
      return false;
    }
  };

  const resetAll = () => {
    setSelectedFolder(null);
    setControlFilePath(null);
    setVesselInfo(null);
    setParameterBounds(null);
    setRepresentativeDrafts(null);
    setArtStatus(0);
    setArtMode('standard');
    fileSystem.setBasePath('');
  };

  const loadControlFile = async (controlPath: string): Promise<{ success: boolean; error?: string; artStatus?: 0 | 1 }> => {
    try {
      const result = await dataLoader.loadControlFile(controlPath);

      if (!result.success) {
        console.error('Control file loading error:', result.error);
        return { success: false, error: result.error };
      }

      setVesselInfo(result.vesselInfo ?? null);
      setParameterBounds(result.parameterBounds ?? null);
      setRepresentativeDrafts(result.representativeDrafts ?? null);
      setArtStatus(result.artStatus ?? 0);
      setArtMode('standard');
      setControlFilePath(controlPath);

      return { success: true, artStatus: result.artStatus ?? 0 };
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
    artStatus,
    artMode,
    setArtMode,
    isElectronMode: isElectron,
    selectFolder,
    selectProject,
    setApiUserId,
    selectControlFile,
    loadControlFile,
    resetAll,
    isReady,
  };

  return <ElectronContext.Provider value={value}>{children}</ElectronContext.Provider>;
};

export const useElectron = (): ElectronContextType => {
  const context = useContext(ElectronContext);
  if (!context) {
    throw new Error('useElectron must be used within an ElectronProvider');
  }
  return context;
};
