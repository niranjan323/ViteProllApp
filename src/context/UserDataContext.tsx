import { createContext, useContext, useState, type ReactNode } from 'react';

export interface VesselOperationData
{
    draftAftPeak: number;
    draftForePeak: number;
    gm: number;
    heading: number;
    speed: number;
    maxAllowedRoll: number;
}

export interface SeaStateData
{
    meanWaveDirection: number;
    significantWaveHeight: number;
    wavePeriod: number;
}

export interface UserInputData
{
    vesselOperation: VesselOperationData;
    seaState: SeaStateData;
    selectedFolder: string;
    controlFile: string;
    draft: 'design' | 'intermediate' | 'scantling';
}

interface UserDataContextType
{
    userInputData: UserInputData;
    setUserInputData: (data: UserInputData) => void;
    updateVesselOperation: (data: Partial<VesselOperationData>) => void;
    updateSeaState: (data: Partial<SeaStateData>) => void;
    setSelectedFolder: (folder: string) => void;
    setControlFile: (file: string) => void;
    setDraft: (draft: 'design' | 'intermediate' | 'scantling') => void;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider = ({ children }: { children: ReactNode; }) =>
{
    const [ userInputData, setUserInputData ] = useState<UserInputData>({
        vesselOperation: {
            draftAftPeak: 10,
            draftForePeak: 10,
            gm: 3.0,  // HIGHER GM = GOOD CONTRAST between safe/danger zones
            heading: 0,  // Head seas - vessel facing north
            speed: 12,  // Moderate speed for good color distribution
            maxAllowedRoll: 15,  // Shows all 3 traffic light colors
        },
        seaState: {
            meanWaveDirection: 90,  // Beam seas from EAST = danger at 90/270
            significantWaveHeight: 6,  // MODERATE seas = good roll range
            wavePeriod: 10.0,
        },
        selectedFolder: '',
        controlFile: '',
        draft: 'design',
    });

    const updateVesselOperation = (data: Partial<VesselOperationData>) =>
    {
        setUserInputData((prev) => ({
            ...prev,
            vesselOperation: { ...prev.vesselOperation, ...data },
        }));
    };

    const updateSeaState = (data: Partial<SeaStateData>) =>
    {
        setUserInputData((prev) => ({
            ...prev,
            seaState: { ...prev.seaState, ...data },
        }));
    };

    const setSelectedFolder = (folder: string) =>
    {
        setUserInputData((prev) => ({
            ...prev,
            selectedFolder: folder,
        }));
    };

    const setControlFile = (file: string) =>
    {
        setUserInputData((prev) => ({
            ...prev,
            controlFile: file,
        }));
    };

    const setDraft = (draft: 'design' | 'intermediate' | 'scantling') =>
    {
        setUserInputData((prev) => ({
            ...prev,
            draft,
        }));
    };

    return (
        <UserDataContext.Provider
            value={{
                userInputData,
                setUserInputData,
                updateVesselOperation,
                updateSeaState,
                setSelectedFolder,
                setControlFile,
                setDraft,
            }}
        >
            {children}
        </UserDataContext.Provider>
    );
};

export const useUserData = () =>
{
    const context = useContext(UserDataContext);
    if (!context)
    {
        throw new Error('useUserData must be used within UserDataProvider');
    }
    return context;
};
