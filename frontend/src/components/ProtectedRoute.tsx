import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/auth";

// Contrôle d'accès par rôle côté client (RBAC) — l'API réapplique systématiquement ce contrôle.
export function ProtectedRoute({ rolesAutorises }: { rolesAutorises: Role[] }) {
  const { utilisateur, chargement } = useAuth();

  if (chargement) return <div className="p-8 text-center text-gray-500">Chargement…</div>;
  if (!utilisateur) return <Navigate to="/connexion" replace />;
  if (!rolesAutorises.includes(utilisateur.role)) return <Navigate to="/connexion" replace />;

  return <Outlet />;
}
