import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { sectionsNavigation } from "../config/navigation";

const LIBELLES_ROLE: Record<string, string> = {
  RH: "Responsable Comptable Financier RH",
  DG: "Direction Générale",
  ADMIN: "Administrateur",
};

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/);
  return mots.slice(0, 2).map((m) => m[0]?.toUpperCase() ?? "").join("");
}

export function PrivateLayout() {
  const { utilisateur, deconnexion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [reduit, setReduit] = useState(false);

  const compteur = useQuery({
    queryKey: ["notifications-compteur"],
    queryFn: async () => (await api.get<{ total: number }>("/notifications/compteur")).data,
    enabled: !!utilisateur,
    refetchInterval: 30_000,
  });

  if (!utilisateur) return null;

  async function handleDeconnexion() {
    await deconnexion();
    navigate("/connexion");
  }

  const total = compteur.data?.total ?? 0;
  const sections = sectionsNavigation(utilisateur.role);
  const largeurSidebar = reduit ? "w-[76px]" : "w-[260px]";

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center justify-between bg-[#004B9C] px-5">
        <Link to="/espace/demandes" className="flex items-center">
          <img src="/logosim.webp" alt="SIM ASSURANCES" className="h-9 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/espace/demandes")}
            title={total > 0 ? `${total} action${total > 1 ? "s" : ""} en attente` : "Aucune action en attente"}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
          >
            <Bell className="h-[18px] w-[18px]" />
            {total > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#004B9C]">
                {total > 9 ? "9+" : total}
              </span>
            )}
          </button>
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold text-white">{utilisateur.nom}</p>
            <p className="text-xs text-white/70">{LIBELLES_ROLE[utilisateur.role] ?? utilisateur.role}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#51AEE2] text-sm font-semibold text-white">
            {initiales(utilisateur.nom)}
          </div>
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 top-16 z-10 flex ${largeurSidebar} flex-col border-r border-gray-200 bg-white transition-[width] duration-150`}
      >
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.titre} className="mb-5">
              {!reduit && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {section.titre}
                </p>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const actif = location.pathname.startsWith(item.to);
                  const Icone = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        title={reduit ? item.label : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          actif ? "bg-[#004B9C] text-white" : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <Icone className="h-[18px] w-[18px] shrink-0" />
                        {!reduit && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-3">
          <button
            onClick={() => setReduit((v) => !v)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            {reduit ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
            {!reduit && <span>Réduire</span>}
          </button>
          <button
            onClick={handleDeconnexion}
            title={reduit ? "Déconnexion" : undefined}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!reduit && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      <main className={`pt-16 transition-[padding] duration-150 ${reduit ? "pl-[76px]" : "pl-[260px]"}`}>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
