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
    resetUserData: () => void;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider = ({ children }: { children: ReactNode; }) =>
{
    const [ userInputData, setUserInputData ] = useState<UserInputData>({
        vesselOperation: {
            draftAftPeak: NaN,
            draftForePeak: NaN,
            gm: NaN,
            heading: NaN,
            speed: NaN,
            maxAllowedRoll: NaN,
        },
        seaState: {
            meanWaveDirection: NaN,
            significantWaveHeight: NaN,
            wavePeriod: NaN,
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

    const resetUserData = () =>
    {
        setUserInputData({
            vesselOperation: {
                draftAftPeak: NaN,
                draftForePeak: NaN,
                gm: NaN,
                heading: NaN,
                speed: NaN,
                maxAllowedRoll: NaN,
            },
            seaState: {
                meanWaveDirection: NaN,
                significantWaveHeight: NaN,
                wavePeriod: NaN,
            },
            selectedFolder: '',
            controlFile: '',
            draft: 'design',
        });
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
                resetUserData,
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
