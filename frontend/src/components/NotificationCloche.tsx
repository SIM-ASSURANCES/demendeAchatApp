import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { api } from "../lib/api";

interface NotificationItem {
  id: string;
  titre: string;
  message: string;
  lien: string | null;
  creeLe: string;
}

// Cloche de l'espace privé : badge rouge = nombre de notifications non lues. Au clic, le panneau
// affiche les dernières non lues puis les marque comme lues — elles ne réapparaissent plus au
// prochain calcul du compteur ni de la liste (marquer-lues côté serveur), tout en restant visibles
// dans ce panneau tant qu'il reste ouvert.
export function NotificationCloche() {
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const dejaMarquees = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const compteur = useQuery({
    queryKey: ["notifications-compteur"],
    queryFn: async () => (await api.get<{ total: number }>("/notifications/compteur")).data,
    refetchInterval: 30_000,
  });

  const notifications = useQuery({
    queryKey: ["notifications-liste"],
    queryFn: async () => (await api.get<NotificationItem[]>("/notifications")).data,
    enabled: ouvert,
  });

  const marquerLues = useMutation({
    mutationFn: async () => api.post("/notifications/marquer-lues"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications-compteur"] }),
  });

  // Dès que le panneau est ouvert et que la liste (même vide) a été chargée, on marque comme lues —
  // une seule fois par ouverture, pour ne pas reboucler à chaque re-render.
  useEffect(() => {
    if (ouvert && notifications.isSuccess && !dejaMarquees.current) {
      dejaMarquees.current = true;
      if ((notifications.data?.length ?? 0) > 0) marquerLues.mutate();
    }
    if (!ouvert) dejaMarquees.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, notifications.isSuccess]);

  useEffect(() => {
    function fermerSiExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false);
    }
    if (ouvert) document.addEventListener("mousedown", fermerSiExterieur);
    return () => document.removeEventListener("mousedown", fermerSiExterieur);
  }, [ouvert]);

  const total = compteur.data?.total ?? 0;

  return (
    <div className="relative" ref={conteneurRef}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        title={total > 0 ? `${total} notification${total > 1 ? "s" : ""} non lue${total > 1 ? "s" : ""}` : "Aucune notification"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
      >
        <Bell className="h-[18px] w-[18px]" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[#004B9C]">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute right-0 top-11 z-30 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.isLoading && <p className="px-4 py-6 text-center text-sm text-gray-500">Chargement…</p>}
            {notifications.isSuccess && notifications.data.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-500">Aucune notification non lue.</p>
            )}
            {notifications.data?.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOuvert(false);
                  if (n.lien) navigate(n.lien);
                }}
                className="block w-full border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50"
              >
                <p className="text-sm font-medium text-gray-800">{n.titre}</p>
                {n.message && <p className="mt-0.5 text-xs text-gray-500">{n.message}</p>}
                <p className="mt-1 text-[11px] text-gray-400">{new Date(n.creeLe).toLocaleString("fr-FR")}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
