import React, { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { UserEmailProvider } from '../context/UserEmailContext';
import { ApiUserService } from '../services/apiUserService';

/**
 * Reads the signed-in user from MSAL, exposes their localAccountId (Azure AD
 * Object ID) via useUserEmail(), and auto-registers them in the Users table on
 * first login.
 */
export function WebUserEmailProvider({ children }: { children: React.ReactNode }) {
    const { accounts } = useMsal();
    const account = accounts[0];
    const userId = account?.localAccountId ?? '';

    useEffect(() => {
        if (!account?.localAccountId) return;
        ApiUserService.ensureUser(
            account.localAccountId,
            account.name ?? account.username ?? '',
            account.username,
        ).catch(() => {
            // Best-effort — don't block the app if registration fails
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account?.localAccountId]);

    return <UserEmailProvider value={userId}>{children}</UserEmailProvider>;
}
