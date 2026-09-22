import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

function ProtectedRoute({ children, allowedRoles }) {
  const auth = useAuth();

  if (auth.isInitializing) {
    return <div aria-live="polite">Verificando sesión...</div>;
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(auth.rol)) {
    return <Navigate to={auth.rol === "ADMIN" ? "/admin/dashboard" : "/inicio"} replace />;
  }

  return children;
}

export default ProtectedRoute;
