import React, { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { UserEmailProvider } from '../context/UserEmailContext';
import { UserDisplayProvider } from '../context/UserDisplayContext';
import { ApiUserService } from '../services/apiUserService';

/**
 * Reads the signed-in user from MSAL, exposes a stable user ID via
 * useUserEmail(), and auto-registers them in the Users table on first login.
 *
 * Handles both AAD (localAccountId = OID) and B2C (localAccountId may be
 * empty; falls back to idTokenClaims.oid then idTokenClaims.sub).
 * B2C stores emails in idTokenClaims.emails[] rather than account.username.
 */
export function WebUserEmailProvider({ children }: { children: React.ReactNode }) {
    const { accounts } = useMsal();
    const account = accounts[0];

    const claims = account?.idTokenClaims as Record<string, unknown> | undefined;
    const userId =
        account?.localAccountId ||
        (claims?.oid as string | undefined) ||
        (claims?.sub as string | undefined) ||
        '';

    const email =
        (claims?.emails as string[] | undefined)?.[0] ??
        account?.username ??
        '';

    useEffect(() => {
        if (!userId) return;
        ApiUserService.ensureUser(
            userId,
            account?.name ?? email,
            email,
        ).catch(() => {
            // Best-effort — don't block the app if registration fails
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    return (
        <UserEmailProvider value={userId}>
            <UserDisplayProvider value={{ displayName: account?.name ?? '', email }}>
                {children}
            </UserDisplayProvider>
        </UserEmailProvider>
    );
}
