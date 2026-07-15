import {
    type Configuration,
    type RedirectRequest,
    BrowserCacheLocation,
} from '@azure/msal-browser';

const INTERNAL_PATH = '/internal';
const INTERNAL_FLAG = 'authMode.internal';


export function isInternalLogin(): boolean {
    if (typeof window === 'undefined') return false;

    const path = window.location.pathname.toLowerCase();
    if (path.includes(INTERNAL_PATH)) {
        window.sessionStorage.setItem(INTERNAL_FLAG, 'true');
        return true;
    }
    return window.sessionStorage.getItem(INTERNAL_FLAG) === 'true';
}

const AAD_ENVIRONMENTS = ['login.windows.net', 'login.microsoftonline.com'];
export function isInternalIntent(): boolean {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(INTERNAL_FLAG) === 'true';
}

export function isAzureAdAccount(account: { environment?: string } | null | undefined): boolean {
    const env = account?.environment ?? '';
    return AAD_ENVIRONMENTS.some((host) => env.includes(host));
}

/*  Azure AD */
const azureAdClientId =
    import.meta.env.VITE_AZURE_CLIENT_ID ?? '443b366a-a00b-4fde-aa19-3578cc040008';
const azureAdTenantId =
    import.meta.env.VITE_AZURE_TENANT_ID ?? 'd810b06c-d004-4d52-b0aa-4f3581ee7020';

const azureAdConfig: Configuration = {
    auth: {
        clientId: azureAdClientId,
        authority: `https://login.microsoftonline.com/${azureAdTenantId}`,
        redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
        postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
    },
    cache: {
        cacheLocation: BrowserCacheLocation.SessionStorage,
    },
};

const azureAdLoginRequest: RedirectRequest = {
    scopes: ['openid', 'profile', 'email', `api://${azureAdClientId}/access_as_user`],
};

/*  Azure B2C */
const b2cClientId =
    import.meta.env.VITE_B2C_CLIENT_ID ?? 'ad16afbd-17e8-4f65-90bd-e8cc8345136c';
const b2cSignInPolicy =
    import.meta.env.VITE_B2C_SIGNIN_POLICY ?? 'b2c_1a_abs_signin_mfa';
const b2cAuthorityDomain =
    import.meta.env.VITE_B2C_AUTHORITY_DOMAIN ?? 'login-uat.eagle.org';
const b2cAuthority =
    import.meta.env.VITE_B2C_AUTHORITY ??
    `https://${b2cAuthorityDomain}/${b2cAuthorityDomain}/${b2cSignInPolicy}`;
const b2cRedirectUri =
    import.meta.env.VITE_B2C_REDIRECT_URI ??
    (typeof window !== 'undefined' ? window.location.origin : '/');

const b2cConfig: Configuration = {
    auth: {
        clientId: b2cClientId,
        authority: b2cAuthority,
        knownAuthorities: [b2cAuthorityDomain],
        redirectUri: b2cRedirectUri,
        postLogoutRedirectUri: b2cRedirectUri,
    },
    cache: {
        cacheLocation: BrowserCacheLocation.SessionStorage,
    },
};

const b2cScope = import.meta.env.VITE_B2C_API_SCOPE;
const b2cLoginRequest: RedirectRequest = {
    scopes: b2cScope
        ? ['openid', 'profile', 'email', b2cScope]
        : ['openid', 'profile', 'email'],
};

export const msalConfig: Configuration = isInternalLogin()
    ? azureAdConfig
    : b2cConfig;

export const loginRequest: RedirectRequest = isInternalLogin()
    ? azureAdLoginRequest
    : b2cLoginRequest;
