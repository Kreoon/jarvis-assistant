"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  List,
  Focus,
  Briefcase,
  Code,
  Megaphone,
  Globe,
  Star,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Workspace } from "@/lib/tasks/types";

// Mapa de iconos disponibles — expandible
const ICON_MAP: Record<string, React.ElementType> = {
  briefcase: Briefcase,
  code: Code,
  megaphone: Megaphone,
  globe: Globe,
  star: Star,
  folder: Folder,
  default: Folder,
};

interface SidebarProps {
  workspaces: Workspace[];
}

export function Sidebar({ workspaces }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/command-center", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/command-center/board", label: "Board", icon: Kanban, exact: false },
    { href: "/command-center/list", label: "Lista", icon: List, exact: false },
  ];

  return (
    <aside
      className="w-[220px] flex flex-col glass-panel h-full overflow-hidden"
      aria-label="Navegación Command Center"
    >
      <div className="hud-border hud-tl" />
      <div className="hud-border hud-tr" />
      <div className="hud-border hud-bl" />
      <div className="hud-border hud-br" />

      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-jarvis-cyan/10">
        <p className="text-[9px] text-jarvis-cyan/40 tracking-[0.3em] uppercase font-bold">
          Command Center
        </p>
        <p className="text-jarvis-cyan text-xs mt-0.5 tracking-widest glowing-text">
          JARVIS-OS
        </p>
      </div>

      {/* Navegación principal */}
      <nav className="px-2 pt-3 pb-2 flex flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-sm text-xs tracking-widest transition-all duration-200",
                isActive
                  ? "text-jarvis-cyan bg-jarvis-cyan/10 border border-jarvis-cyan/20"
                  : "text-jarvis-cyan/40 hover:text-jarvis-cyan/80 hover:bg-jarvis-cyan/5"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label.toUpperCase()}</span>
            </Link>
          );
        })}
      </nav>

      {/* Divisor workspaces */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-[9px] text-jarvis-cyan/30 tracking-widest uppercase">
          Workspaces
        </p>
      </div>

      {/* Lista de workspaces */}
      <nav className="px-2 flex flex-col gap-0.5 overflow-y-auto flex-1 custom-scrollbar pb-4">
        {workspaces.map((ws) => {
          const Icon = ICON_MAP[ws.icon] ?? ICON_MAP.default;
          const href = `/command-center/board/${ws.slug}`;
          const isActive = pathname === href;

          return (
            <Link
              key={ws.id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-sm text-xs tracking-widest transition-all duration-200 group",
                isActive
                  ? "bg-jarvis-cyan/10 border border-jarvis-cyan/20"
                  : "hover:bg-jarvis-cyan/5"
              )}
            >
              <span
                className="w-5 h-5 flex items-center justify-center rounded-sm flex-shrink-0"
                style={{ color: ws.color }}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span
                className={cn(
                  "truncate transition-colors",
                  isActive ? "text-white" : "text-jarvis-cyan/50 group-hover:text-jarvis-cyan/80"
                )}
              >
                {ws.name.toUpperCase()}
              </span>
              {isActive && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ws.color }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Focus link en footer */}
      <div className="border-t border-jarvis-cyan/10 px-2 py-3">
        <Link
          href="/command-center/focus"
          className="flex items-center gap-3 px-3 py-2 rounded-sm text-xs tracking-widest text-jarvis-cyan/40 hover:text-jarvis-cyan hover:bg-jarvis-cyan/5 transition-all duration-200"
        >
          <Focus className="w-4 h-4" aria-hidden="true" />
          <span>MODO FOCO</span>
        </Link>
      </div>
    </aside>
  );
}
