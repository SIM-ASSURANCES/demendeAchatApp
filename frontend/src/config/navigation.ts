import type { LucideIcon } from "lucide-react";
import { FileStack, BarChart3, Wallet, Settings } from "lucide-react";
import type { Role } from "../lib/auth";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavSection {
  titre: string;
  items: NavItem[];
}

// Structure de la barre latérale des espaces privés, par rôle.
export function sectionsNavigation(role: Role): NavSection[] {
  const sections: NavSection[] = [
    {
      titre: "Demandes",
      items: [{ label: "Toutes les demandes", to: "/espace/demandes", icon: FileStack }],
    },
    {
      titre: "Pilotage",
      items: [
        { label: "Rapports", to: "/espace/rapports", icon: BarChart3 },
        { label: "Budgets", to: "/espace/budgets", icon: Wallet },
      ],
    },
  ];

  if (role === "ADMIN") {
    sections.push({
      titre: "Administration",
      items: [{ label: "Paramètres", to: "/admin", icon: Settings }],
    });
  }

  return sections;
}
