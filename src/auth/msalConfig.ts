import { Configuration, BrowserCacheLocation } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID ?? '443b366a-a00b-4fde-aa19-3578cc040008',
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID ?? 'd810b06c-d004-4d52-b0aa-4f3581ee7020'}`,
        redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
        postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
    },
    cache: {
        cacheLocation: BrowserCacheLocation.SessionStorage,
        storeAuthStateInCookie: false,
    },
};



export const loginRequest = {
    scopes: ['openid', 'profile', 'email', 'api://443b366a-a00b-4fde-aa19-3578cc040008/access_as_user'],
};
