import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout() {
  const { utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();

  async function handleDeconnexion() {
    await deconnexion();
    navigate("/connexion");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#1F3864] text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-wide">
            SIM ASSURANCES — Demandes d'achat
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="hover:underline">Nouvelle demande</Link>
            <Link to="/suivi" className="hover:underline">Suivre une demande</Link>
            {utilisateur ? (
              <>
                {(utilisateur.role === "RH" || utilisateur.role === "DG") && (
                  <Link to="/espace/demandes" className="hover:underline">Espace {utilisateur.role}</Link>
                )}
                {utilisateur.role === "ADMIN" && (
                  <Link to="/admin" className="hover:underline">Administration</Link>
                )}
                <span className="text-white/70">{utilisateur.nom}</span>
                <button onClick={handleDeconnexion} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                  Déconnexion
                </button>
              </>
            ) : (
              <Link to="/connexion" className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                Connexion RH / DG / Admin
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 bg-[#f4f6f9]">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Outlet />
        </div>
      </main>
      <footer className="border-t bg-white py-4 text-center text-xs text-gray-500">
        SIM ASSURANCES — Application de gestion des demandes d'achat
      </footer>
    </div>
  );
}
