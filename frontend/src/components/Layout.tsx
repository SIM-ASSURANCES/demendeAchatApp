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
      <header className="bg-[#004B9C]">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logosim.webp" alt="SIM ASSURANCES" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white">
            <Link to="/" className="hover:underline">Nouvelle demande</Link>
            <Link to="/suivi" className="hover:underline">Suivre une demande</Link>
            {utilisateur ? (
              <>
                <Link
                  to={utilisateur.role === "ADMIN" ? "/admin" : "/espace/demandes"}
                  className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
                >
                  Accéder à mon espace
                </Link>
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
