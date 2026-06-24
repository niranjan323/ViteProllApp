import type { PublicClientApplication } from '@azure/msal-browser';

// Stored at module level so apiCaseService.ts can acquire tokens without being a React component.
let _instance: PublicClientApplication | null = null;

export function setMsalInstance(instance: PublicClientApplication): void {
    _instance = instance;
}

/**
 * Acquires an access token silently for the CRoll API scope.
 * Returns null if MSAL is not initialised, no accounts are signed in,
 * or silent acquisition fails (e.g. consent not yet granted).
 *
 * Azure AD setup required:
 *   App Registration → Expose an API → Application ID URI = api://443b366a-a00b-4fde-aa19-3578cc040008
 *   Add scope: access_as_user
 */
export async function getAccessToken(): Promise<string | null> {
    if (!_instance) return null;
    const accounts = _instance.getAllAccounts();
    if (!accounts.length) return null;
    try {
        const result = await _instance.acquireTokenSilent({
            scopes: ['api://443b366a-a00b-4fde-aa19-3578cc040008/access_as_user'],
            account: accounts[0],
        });
        return result.accessToken;
    } catch {
        // Consent not yet granted or interaction required — proceed without Bearer header
        return null;
    }
}
