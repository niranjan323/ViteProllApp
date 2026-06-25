import React from 'react';
import { useMsal } from '@azure/msal-react';
import { UserEmailProvider } from '../context/UserEmailContext';

/**
 * Reads the signed-in user's email from MSAL accounts and makes it available
 * via useUserEmail(). Only rendered inside MsalProvider (web mode).
 */
export function WebUserEmailProvider({ children }: { children: React.ReactNode }) {
    const { accounts } = useMsal();
    const email = accounts[0]?.localAccountId ?? '';
    return <UserEmailProvider value={email}>{children}</UserEmailProvider>;
}
