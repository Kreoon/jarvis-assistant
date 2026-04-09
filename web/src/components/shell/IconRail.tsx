"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckSquare,
  Folder,
  Calendar,
  FileText,
  MessageCircle,
  Target,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",        label: "Inicio",     icon: Home,          exact: true },
  { href: "/tasks",   label: "Tareas",     icon: CheckSquare },
  { href: "/projects",label: "Proyectos",  icon: Folder },
  { href: "/agenda",  label: "Agenda",     icon: Calendar },
  { href: "/notes",   label: "Notas",      icon: FileText },
  { href: "/chat",    label: "Chat",       icon: MessageCircle },
  { href: "/focus",   label: "Foco",       icon: Target },
  { href: "/settings",label: "Ajustes",    icon: Settings },
];

export function IconRail() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col items-center",
        "w-16 h-full flex-shrink-0",
        "bg-[color:var(--surface-solid)] border-r border-[color:var(--border)]",
        "safe-left py-4 gap-1"
      )}
      aria-label="Navegación principal"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);

        return (
          <Tooltip key={href} content={label} side="right">
            <Link
              href={href}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center justify-center",
                "w-10 h-10 rounded-[var(--radius-md)]",
                "transition-colors duration-200",
                isActive
                  ? "text-[color:var(--accent)] bg-[rgba(94,142,255,0.12)]"
                  : "text-[color:var(--text-mute)] hover:text-[color:var(--text-dim)] hover:bg-[color:var(--surface-2)]"
              )}
            >
              {/* Indicador activo izquierdo */}
              {isActive ? (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[calc(100%+8px)] w-0.5 h-5 rounded-full bg-[color:var(--accent)]"
                  aria-hidden="true"
                />
              ) : null}
              <Icon className="w-5 h-5" aria-hidden="true" />
            </Link>
          </Tooltip>
        );
      })}
    </aside>
  );
}
