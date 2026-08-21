import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authentifier } from "../../middleware/auth.middleware";

export const notificationsRouter = Router();

notificationsRouter.use(authentifier);

// Nombre de notifications non lues — badge rouge de la cloche.
notificationsRouter.get("/compteur", async (req, res) => {
  const total = await prisma.notification.count({
    where: { destinataireId: req.utilisateur!.sub, lu: false },
  });
  res.json({ total });
});

// Dernières notifications non lues, affichées dans le panneau ouvert au clic sur la cloche.
notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { destinataireId: req.utilisateur!.sub, lu: false },
    orderBy: { creeLe: "desc" },
    take: 20,
  });
  res.json(notifications);
});

// Marque comme lues les notifications encore non lues (celles qui viennent d'être consultées dans
// le panneau) — elles ne réapparaîtront plus au prochain calcul du compteur ni de la liste.
notificationsRouter.post("/marquer-lues", async (req, res) => {
  await prisma.notification.updateMany({
    where: { destinataireId: req.utilisateur!.sub, lu: false },
    data: { lu: true },
  });
  res.status(204).send();
});
