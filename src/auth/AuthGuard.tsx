import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { useElectron } from '../context/ElectronContext';
import { LoginPage } from '../pages/LoginPage';

// Inner component — only rendered in web mode (MsalProvider must be present)
function WebAuthGuard({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useIsAuthenticated();
    const { inProgress } = useMsal();

    // MSAL is processing a redirect or popup — show nothing while it resolves
    if (inProgress !== InteractionStatus.None) {
        return null;
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <>{children}</>;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isElectronMode } = useElectron();

    // Electron desktop: no login required
    if (isElectronMode) {
        return <>{children}</>;
    }

    // Web: enforce Azure AD login
    return <WebAuthGuard>{children}</WebAuthGuard>;
}
