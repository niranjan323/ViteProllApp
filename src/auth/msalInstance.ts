import type { PublicClientApplication } from '@azure/msal-browser';
import { isAzureAdAccount } from './msalConfig';

let _instance: PublicClientApplication | null = null;

export function setMsalInstance(instance: PublicClientApplication): void {
    _instance = instance;
}

// AAD API scope — App Registration → Expose an API → CRollNonprod
const AAD_API_SCOPE = 'api://443b366a-a00b-4fde-aa19-3578cc040008/CRollNonprod';

/**
 * Acquires an access token silently.
 * AAD users → CRollNonprod scope.
 * B2C users → VITE_B2C_API_SCOPE env var (null if not configured yet).
 * Returns null on any failure — API calls proceed without Bearer (safe while [Authorize] is commented out locally).
 */
export async function getAccessToken(): Promise<string | null> {
    if (!_instance) return null;
    const accounts = _instance.getAllAccounts();
    if (!accounts.length) return null;
    const account = accounts[0];

    const scope = isAzureAdAccount(account)
        ? AAD_API_SCOPE
        : (import.meta.env.VITE_B2C_API_SCOPE as string | undefined);

    if (!scope) return null;

    try {
        const result = await _instance.acquireTokenSilent({ scopes: [scope], account });
        return result.accessToken;
    } catch {
        return null;
    }
}
