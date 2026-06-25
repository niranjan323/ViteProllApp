import { type Configuration, BrowserCacheLocation } from '@azure/msal-browser';

export const msalConfig: Configuration = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
        redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
        postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
    },
    cache: {
        cacheLocation: BrowserCacheLocation.SessionStorage,
    },
};



export const loginRequest = {
    scopes: ['openid', 'profile', 'email', 'api://443b366a-a00b-4fde-aa19-3578cc040008/access_as_user'],
};
