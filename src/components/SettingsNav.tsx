"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash, MapPin, Globe, Sparkles, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
}

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    href: "/settings/categories",
    label: "Categories",
    icon: Hash,
  },
  {
    href: "/settings/preferences",
    label: "Work Preferences",
    icon: MapPin,
  },
  {
    href: "/settings/scraper",
    label: "Scraper Targets",
    icon: Globe,
  },
  {
    href: "/settings/assistant",
    label: "AI Assistant",
    icon: Sparkles,
    iconClassName: "text-primary",
  },
  {
    href: "/settings/cv-library",
    label: "CV Library",
    icon: FileText,
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings navigation"
      className="flex flex-row md:flex-col w-full h-auto p-1 bg-muted/60 rounded-xl gap-1 overflow-x-auto md:overflow-visible"
    >
      {SETTINGS_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href === "/settings/categories" && pathname === "/settings");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-left shrink-0 md:shrink",
              isActive
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className={cn("w-4 h-4 shrink-0", item.iconClassName)} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
