import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";

import { loginRequest } from "../authConfig";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const LEGACY_AUTH_STORAGE_KEYS = ["token", "userId", "nombre", "email", "rol"];
const EMPTY_AUTH = {
  token: null,
  userId: null,
  nombre: null,
  email: null,
  rol: null,
  isAuthenticated: false,
  isLinked: false,
};

export const AuthContext = createContext(null);

const clearLegacySession = () => {
  LEGACY_AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

export function AuthProvider({ children }) {
  const { instance, accounts } = useMsal();
  const isMicrosoftAuthenticated = useIsAuthenticated();
  const [auth, setAuth] = useState(EMPTY_AUTH);
  const [isInitializing, setIsInitializing] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const initializationRef = useRef(null);

  const refreshSession = useCallback(() => {
    setRefreshVersion((currentVersion) => currentVersion + 1);
  }, []);

  const clearSession = useCallback(async () => {
    clearLegacySession();
    setAuth(EMPTY_AUTH);

    const account = instance.getActiveAccount() ?? accounts[0];

    if (account) {
      try {
        await instance.logoutRedirect({
          account,
          postLogoutRedirectUri: "http://localhost:5173/",
        });
      } catch {
        // El estado local ya fue limpiado; MSAL puede reintentar el cierre en la siguiente interacción.
      }
    }
  }, [accounts, instance]);

  useEffect(() => {
    let isCurrent = true;
    const account = instance.getActiveAccount() ?? accounts[0];

    if (!isMicrosoftAuthenticated || !account) {
      clearLegacySession();
      initializationRef.current = null;

      Promise.resolve().then(() => {
        if (isCurrent) {
          setAuth(EMPTY_AUTH);
          setIsInitializing(false);
        }
      });

      return () => {
        isCurrent = false;
      };
    }

    const initializationKey = `${account.homeAccountId}:${refreshVersion}`;

    if (!initializationRef.current || initializationRef.current.key !== initializationKey) {
      const initializationPromise = (async () => {
        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        const userResponse = await fetch(`${apiBaseUrl}/bff/usuarios/me`, {
          headers: {
            Authorization: `Bearer ${tokenResponse.accessToken}`,
          },
        });

        let userData;

        try {
          userData = await userResponse.json();
        } catch {
          userData = null;
        }

        if (!userResponse.ok || !userData) {
          throw new Error("No se pudo consultar el usuario Microsoft.");
        }

        return userData;
      })();

      initializationRef.current = { key: initializationKey, promise: initializationPromise };
    }

    Promise.resolve().then(() => {
      if (isCurrent) {
        setIsInitializing(true);
      }
    });

    initializationRef.current.promise
      .then((userData) => {
        if (!isCurrent) {
          return;
        }

        clearLegacySession();

        if (userData.linked === true && Number.isFinite(Number(userData.userId))) {
          setAuth({
            ...EMPTY_AUTH,
            userId: Number(userData.userId),
            nombre: userData.nombre ?? null,
            email: userData.email ?? null,
            rol: userData.rol ?? null,
            isAuthenticated: true,
            isLinked: true,
          });
        } else {
          setAuth({ ...EMPTY_AUTH, isLinked: false });
        }
      })
      .catch(() => {
        if (isCurrent) {
          clearLegacySession();
          setAuth({ ...EMPTY_AUTH, isLinked: false });
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsInitializing(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accounts, instance, isMicrosoftAuthenticated, refreshVersion]);

  const value = useMemo(
    () => ({
      ...auth,
      isInitializing,
      refreshSession,
      clearSession,
    }),
    [auth, clearSession, isInitializing, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
