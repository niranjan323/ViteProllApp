import { useEffect } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { useElectron } from '../context/ElectronContext';
import { loginRequest } from './msalConfig';

// Inner component — only rendered in web mode (MsalProvider must be present)
function WebAuthGuard({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useIsAuthenticated();
    const { instance, inProgress } = useMsal();

    useEffect(() => {
        // Auto-redirect to Microsoft login when not authenticated and no interaction in progress
        if (!isAuthenticated && inProgress === InteractionStatus.None) {
            instance.loginRedirect(loginRequest).catch(console.error);
        }
    }, [isAuthenticated, inProgress, instance]);

    // Show nothing while redirecting or processing
    if (!isAuthenticated) {
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

    // Web: auto-redirect to Microsoft login (same flow as Digital Rules)
    return <WebAuthGuard>{children}</WebAuthGuard>;
}
