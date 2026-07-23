import { createContext, useContext } from 'react';

interface UserDisplayInfo {
    displayName: string;
    email: string;
}

const UserDisplayContext = createContext<UserDisplayInfo>({ displayName: '', email: '' });

export function useUserDisplay(): UserDisplayInfo {
    return useContext(UserDisplayContext);
}

export const UserDisplayProvider = UserDisplayContext.Provider;
