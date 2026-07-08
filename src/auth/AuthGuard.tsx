import { useEffect, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { EventType, InteractionStatus } from '@azure/msal-browser';
import type { EventMessage, AccountInfo } from '@azure/msal-browser';
import { useElectron } from '../context/ElectronContext';
import { loginRequest, isInternalIntent, isAzureAdAccount } from './msalConfig';

function MsalWrapper({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useIsAuthenticated();
    const { instance, inProgress } = useMsal();
    const [authSuccess, setAuthSuccess] = useState(false);

    
    useEffect(() => {
        const callbackId = instance.addEventCallback((event: EventMessage) => {
            if (
                event.eventType === EventType.LOGIN_SUCCESS &&
                event.payload &&
                'account' in event.payload &&
                event.payload.account
            ) {
                instance.setActiveAccount(event.payload.account as AccountInfo);
            }
        });
        return () => {
            if (callbackId) instance.removeEventCallback(callbackId);
        };
    }, [instance]);

    
    useEffect(() => {
        if (inProgress !== InteractionStatus.None) return;

        (async () => {
            if (!instance.getActiveAccount()) {
                const accounts = instance.getAllAccounts();
                if (accounts.length > 0) {
                    const account = accounts[0];
                    if (isAzureAdAccount(account) === isInternalIntent()) {
                        instance.setActiveAccount(account);
                    } else {
                        await instance.logoutRedirect({ account });
                        return;
                    }
                } else {
                    // Anonymous user — redirect to the correct login provider.
                    await instance.loginRedirect(loginRequest);
                    return;
                }
            }
            setAuthSuccess(true);
        })().catch((err) => console.error('MSAL auth failed:', err));
    }, [inProgress, instance]);

    // Render nothing while MSAL resolves the session / redirects.
    if (!isAuthenticated || !authSuccess) {
        return null;
    }

    return <>{children}</>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isElectronMode } = useElectron();

    // Electron desktop: no login required
    if (isElectronMode) {
        return <>{children}</>;
    }

    // Web: MSAL-backed auth wrapper (internal Azure AD or external B2C)
    return <MsalWrapper>{children}</MsalWrapper>;
}

