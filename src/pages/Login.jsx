import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { InteractionStatus } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";

import logo from "../assets/logo.png";
import { loginRequest } from "../authConfig";
import { useAuth } from "../hooks/useAuth";
import "../styles/auth.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const decodeAccessTokenClaims = (accessToken) => {
  const payload = accessToken.split(".")[1];
  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decodedPayload = window.atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "="));

  return JSON.parse(decodedPayload);
};

function Login() {
  const auth = useAuth();
  const { instance, accounts, inProgress } = useMsal();
  const isMicrosoftAuthenticated = useIsAuthenticated();
  const [error, setError] = useState("");
  const [accessTokenClaims, setAccessTokenClaims] = useState(null);
  const [claimsError, setClaimsError] = useState("");
  const [apiTestResult, setApiTestResult] = useState(null);
  const [apiTestLoading, setApiTestLoading] = useState(false);
  const [microserviceTests, setMicroserviceTests] = useState({});
  const [microserviceLoading, setMicroserviceLoading] = useState(null);
  const [localUserResult, setLocalUserResult] = useState(null);
  const [localUserLoading, setLocalUserLoading] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const microsoftAccount = accounts[0] ?? instance.getActiveAccount();

  useEffect(() => {
    let isCurrent = true;

    const acquireClaims = async () => {
      if (!isMicrosoftAuthenticated || !microsoftAccount) {
        setAccessTokenClaims(null);
        setClaimsError("");
        return;
      }

      try {
        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account: microsoftAccount,
        });
        const claims = decodeAccessTokenClaims(tokenResponse.accessToken);

        if (isCurrent) {
          setAccessTokenClaims({
            iss: claims.iss ?? "No disponible",
            aud: claims.aud ?? "No disponible",
            ver: claims.ver ?? "No disponible",
            scp: claims.scp ?? "No disponible",
            exp: claims.exp ? new Date(claims.exp * 1000).toLocaleString() : "No disponible",
          });
          setClaimsError("");
        }
      } catch {
        if (isCurrent) {
          setAccessTokenClaims(null);
          setClaimsError("No se pudieron obtener los claims del Access Token.");
        }
      }
    };

    acquireClaims();

    return () => {
      isCurrent = false;
    };
  }, [instance, isMicrosoftAuthenticated, microsoftAccount]);

  if (auth.isAuthenticated) {
    return <Navigate to={auth.rol === "ADMIN" ? "/admin/dashboard" : "/inicio"} replace />;
  }

  const handleMicrosoftLogin = async () => {
    setError("");

    try {
      await instance.loginRedirect(loginRequest);
    } catch {
      setError("No se pudo iniciar sesión con Microsoft.");
    }
  };

  const handleMicrosoftLogout = async () => {
    setError("");

    try {
      await auth.clearSession();
    } catch {
      setError("No se pudo cerrar la sesión de Microsoft.");
    }
  };

  const handleApiTest = async () => {
    setApiTestLoading(true);
    setApiTestResult(null);

    let tokenResponse;

    try {
      tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: microsoftAccount,
      });
    } catch {
      setApiTestResult({
        type: "token",
        message: "No se pudo obtener el Access Token mediante acquireTokenSilent.",
      });
      setApiTestLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/bff/usuarios`, {
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });

      setApiTestResult({
        type: response.ok ? "success" : "http",
        status: response.status,
        message: response.ok
          ? "La petición fue autorizada por el backend."
          : "El backend rechazó la petición. Revisa la configuración de validación de la API.",
      });
    } catch {
      setApiTestResult({
        type: "cors",
        message: "No se recibió respuesta; revisa la conexión con la API y la configuración de CORS.",
      });
    } finally {
      setApiTestLoading(false);
    }
  };

  const handleMicroserviceTest = async (serviceName, endpoint) => {
    setMicroserviceLoading(serviceName);
    setMicroserviceTests((currentTests) => ({
      ...currentTests,
      [serviceName]: null,
    }));

    let tokenResponse;

    try {
      tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: microsoftAccount,
      });
    } catch {
      setMicroserviceTests((currentTests) => ({
        ...currentTests,
        [serviceName]: {
          type: "token",
          message: "No se pudo obtener el Access Token mediante acquireTokenSilent.",
        },
      }));
      setMicroserviceLoading(null);
      return;
    }

    if (serviceName === "ms-coincidencias") {
      try {
        const userResponse = await fetch(`${apiBaseUrl}/bff/usuarios/me`, {
          headers: {
            Authorization: `Bearer ${tokenResponse.accessToken}`,
          },
        });

        if (!userResponse.ok) {
          setMicroserviceTests((currentTests) => ({
            ...currentTests,
            [serviceName]: {
              type: "http",
              status: userResponse.status,
              message: "No se pudo comprobar la vinculación de la cuenta Microsoft.",
            },
          }));
          return;
        }

        let userData;

        try {
          userData = await userResponse.json();
        } catch {
          setMicroserviceTests((currentTests) => ({
            ...currentTests,
            [serviceName]: {
              type: "http",
              status: userResponse.status,
              message: "La respuesta de usuario local no es válida.",
            },
          }));
          return;
        }

        const userId = Number(userData.userId);

        if (userData.linked !== true || !Number.isFinite(userId) || userId <= 0) {
          setMicroserviceTests((currentTests) => ({
            ...currentTests,
            [serviceName]: {
              type: "http",
              status: userResponse.status,
              message: "Falta vincular la cuenta Microsoft con un usuario local válido.",
            },
          }));
          return;
        }

        const response = await fetch(`${apiBaseUrl}/bff/coincidencias/usuario/${userId}`, {
          headers: {
            Authorization: `Bearer ${tokenResponse.accessToken}`,
          },
        });

        setMicroserviceTests((currentTests) => ({
          ...currentTests,
          [serviceName]: {
            type: response.ok ? "success" : "http",
            status: response.status,
            message: response.ok
              ? "La petición fue autorizada por el backend."
              : "El backend rechazó la petición de coincidencias.",
          },
        }));
      } catch {
        setMicroserviceTests((currentTests) => ({
          ...currentTests,
          [serviceName]: {
            type: "cors",
            message: "No se recibió respuesta; revisa la conexión con la API y la configuración de CORS.",
          },
        }));
      } finally {
        setMicroserviceLoading(null);
      }

      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });

      setMicroserviceTests((currentTests) => ({
        ...currentTests,
        [serviceName]: {
          type: response.ok ? "success" : "http",
          status: response.status,
          message: response.ok
            ? "La petición fue autorizada por el backend."
            : "El backend rechazó la petición. Revisa la validación del token en la API.",
        },
      }));
    } catch {
      setMicroserviceTests((currentTests) => ({
        ...currentTests,
        [serviceName]: {
          type: "cors",
          message: "No se recibió respuesta; revisa CORS y que el Gateway esté disponible en localhost:8080.",
        },
      }));
    } finally {
      setMicroserviceLoading(null);
    }
  };

  const handleLocalUserTest = async () => {
    setLocalUserLoading(true);
    setLocalUserResult(null);

    let tokenResponse;

    try {
      tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: microsoftAccount,
      });
    } catch {
      setLocalUserResult({
        type: "token",
        message: "No se pudo obtener el Access Token mediante acquireTokenSilent.",
      });
      setLocalUserLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/bff/usuarios/me`, {
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });
      let responseData;

      try {
        responseData = await response.json();
      } catch {
        setLocalUserResult({
          type: "http",
          status: response.status,
          message: "La respuesta HTTP no contiene un resultado de vinculación válido.",
        });
        return;
      }

      if (responseData.linked === true) {
        setLocalUserResult({
          type: response.ok ? "success" : "http",
          status: response.status,
          linked: true,
          userId: responseData.userId,
          rol: responseData.rol,
        });
      } else if (responseData.linked === false) {
        setLocalUserResult({
          type: response.ok ? "success" : "http",
          status: response.status,
          linked: false,
          message: "La cuenta Microsoft todavía no está vinculada a un usuario local.",
        });
      } else {
        setLocalUserResult({
          type: "http",
          status: response.status,
          message: "La respuesta HTTP no indica si la cuenta está vinculada.",
        });
      }
    } catch {
      setLocalUserResult({
        type: "cors",
        message: "No se recibió respuesta; revisa la conexión con la API y la configuración de CORS.",
      });
    } finally {
      setLocalUserLoading(false);
    }
  };

  const handleLinkLocalUser = async (event) => {
    event.preventDefault();
    setLinkLoading(true);

    let tokenResponse;

    try {
      tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: microsoftAccount,
      });
    } catch {
      setLocalUserResult({
        type: "token",
        message: "No se pudo obtener el Access Token mediante acquireTokenSilent.",
      });
      setLinkPassword("");
      setLinkLoading(false);
      return;
    }

    try {
      const linkResponse = await fetch(`${apiBaseUrl}/bff/usuarios/link-microsoft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
        body: JSON.stringify({
          email: linkEmail,
          password: linkPassword,
        }),
      });

      if (!linkResponse.ok) {
        setLocalUserResult({
          type: "http",
          status: linkResponse.status,
          message: "No se pudo vincular la cuenta. Revisa el estado HTTP y las credenciales locales.",
        });
        return;
      }

      const userResponse = await fetch(`${apiBaseUrl}/bff/usuarios/me`, {
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });
      let userResponseData;

      try {
        userResponseData = await userResponse.json();
      } catch {
        setLocalUserResult({
          type: "http",
          status: userResponse.status,
          message: "La vinculación terminó, pero la respuesta de usuario no es válida.",
        });
        return;
      }

      if (userResponseData.linked === true) {
        setLocalUserResult({
          type: userResponse.ok ? "success" : "http",
          status: userResponse.status,
          linked: true,
          userId: userResponseData.userId,
          rol: userResponseData.rol,
        });
        auth.refreshSession();
      } else if (userResponseData.linked === false) {
        setLocalUserResult({
          type: "http",
          status: userResponse.status,
          linked: false,
          message: "La cuenta Microsoft todavía no está vinculada a un usuario local.",
        });
      } else {
        setLocalUserResult({
          type: "http",
          status: userResponse.status,
          message: "La respuesta de usuario no indica si la cuenta está vinculada.",
        });
      }
    } catch {
      setLocalUserResult({
        type: "cors",
        message: "No se recibió respuesta; revisa la conexión con la API y la configuración de CORS.",
      });
    } finally {
      setLinkPassword("");
      setLinkLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <img className="auth-logo" src={logo} alt="Logo de Sanos y Salvos" />
          <h1>Sanos y Salvos</h1>
          <p>Inicia sesión para acceder a la plataforma.</p>
        </div>

        <div className="auth-msal-section">
          {isMicrosoftAuthenticated ? (
            <>
              <p className="auth-msal-account">
                Sesión de Microsoft activa
              </p>
              {error && <p className="auth-error">{error}</p>}
              <section className="auth-token-claims" aria-labelledby="token-claims-title">
                <h2 id="token-claims-title">Claims del Access Token</h2>
                {claimsError ? (
                  <p className="auth-error">{claimsError}</p>
                ) : accessTokenClaims ? (
                  <dl>
                    <div>
                      <dt>iss</dt>
                      <dd>{accessTokenClaims.iss}</dd>
                    </div>
                    <div>
                      <dt>aud</dt>
                      <dd>{accessTokenClaims.aud}</dd>
                    </div>
                    <div>
                      <dt>ver</dt>
                      <dd>{accessTokenClaims.ver}</dd>
                    </div>
                    <div>
                      <dt>scp</dt>
                      <dd>{accessTokenClaims.scp}</dd>
                    </div>
                    <div>
                      <dt>exp</dt>
                      <dd>{accessTokenClaims.exp}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="auth-msal-account">Obteniendo claims...</p>
                )}
              </section>
              <button
                className="auth-button auth-button-secondary"
                type="button"
                onClick={handleApiTest}
                disabled={apiTestLoading || inProgress !== InteractionStatus.None}
              >
                {apiTestLoading ? "Probando API..." : "Probar API con Microsoft"}
              </button>
              {apiTestResult && (
                <div className={`auth-api-result auth-api-result-${apiTestResult.type}`}>
                  {apiTestResult.status && <strong>HTTP {apiTestResult.status}</strong>}
                  <span>{apiTestResult.message}</span>
                </div>
              )}
              <div className="auth-microservice-tests">
                {[
                  { name: "ms-mascotas", endpoint: "/bff/mascotas" },
                  {
                    name: "ms-coincidencias",
                    endpoint: "/bff/coincidencias/usuario",
                  },
                  { name: "ms-geolocalizacion", endpoint: "/bff/geolocalizacion" },
                ].map(({ name, endpoint }) => (
                  <div key={name}>
                    <button
                      className="auth-button auth-button-secondary"
                      type="button"
                      onClick={() => handleMicroserviceTest(name, endpoint)}
                      disabled={microserviceLoading !== null || inProgress !== InteractionStatus.None}
                    >
                      {microserviceLoading === name ? `Probando ${name}...` : `Probar ${name}`}
                    </button>
                    {microserviceTests[name] && (
                      <div className={`auth-api-result auth-api-result-${microserviceTests[name].type}`}>
                        {microserviceTests[name].status && (
                          <strong>HTTP {microserviceTests[name].status}</strong>
                        )}
                        <span>{microserviceTests[name].message}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="auth-button auth-button-secondary"
                type="button"
                onClick={handleLocalUserTest}
                disabled={localUserLoading || inProgress !== InteractionStatus.None}
              >
                {localUserLoading ? "Consultando usuario local..." : "Consultar mi usuario local"}
              </button>
              {localUserResult && (
                <div className={`auth-api-result auth-api-result-${localUserResult.type}`}>
                  {localUserResult.status && <strong>HTTP {localUserResult.status}</strong>}
                  {localUserResult.linked === true ? (
                    <>
                      <span>linked: true</span>
                      <span>userId: {localUserResult.userId}</span>
                      <span>rol: {localUserResult.rol}</span>
                    </>
                  ) : localUserResult.linked === false ? (
                    <>
                      <span>linked: false</span>
                      <span>{localUserResult.message}</span>
                    </>
                  ) : (
                    <span>{localUserResult.message}</span>
                  )}
                </div>
              )}
              {localUserResult?.linked === false && (
                <form className="auth-form auth-link-form" onSubmit={handleLinkLocalUser}>
                  <h2>Vincular cuenta local</h2>
                  <div className="form-group">
                    <label htmlFor="link-email">Correo de la cuenta local</label>
                    <input
                      id="link-email"
                      type="email"
                      value={linkEmail}
                      onChange={(event) => setLinkEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="link-password">Contraseña de la cuenta local</label>
                    <input
                      id="link-password"
                      type="password"
                      value={linkPassword}
                      onChange={(event) => setLinkPassword(event.target.value)}
                      required
                    />
                  </div>
                  <button
                    className="auth-button auth-button-secondary"
                    type="submit"
                    disabled={linkLoading || inProgress !== InteractionStatus.None}
                  >
                    {linkLoading ? "Vinculando cuenta..." : "Vincular cuenta local"}
                  </button>
                </form>
              )}
              <button
                className="auth-button auth-button-secondary"
                type="button"
                onClick={handleMicrosoftLogout}
                disabled={inProgress !== InteractionStatus.None}
              >
                Cerrar sesión de Microsoft
              </button>
            </>
          ) : (
            <button
              className="auth-button auth-button-secondary"
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={inProgress !== InteractionStatus.None}
            >
              Iniciar sesión con Microsoft
            </button>
          )}
        </div>

        <p className="auth-link">
          ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
        </p>
      </section>
    </main>
  );
}

export default Login;
