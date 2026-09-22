import { PublicClientApplication } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const apiScope = import.meta.env.VITE_API_SCOPE;

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: "http://localhost:5173/",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [apiScope],
};

export const msalInstance = new PublicClientApplication(msalConfig);
