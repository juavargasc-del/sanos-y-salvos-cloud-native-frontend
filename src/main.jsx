import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./authConfig";

async function bootstrap() {
  await msalInstance.initialize();

  // Procesar el resultado cuando Microsoft redirige de vuelta a React.
  const redirectResult = await msalInstance.handleRedirectPromise();

  if (redirectResult?.account) {
    msalInstance.setActiveAccount(redirectResult.account);
  } else {
    const activeAccount = msalInstance.getActiveAccount();
    const accounts = msalInstance.getAllAccounts();

    if (!activeAccount && accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
    }
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MsalProvider>
    </StrictMode>
  );
}

bootstrap().catch(() => {
  console.error("No se pudo inicializar la autenticación de Microsoft.");
});