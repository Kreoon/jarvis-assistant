"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckSquare,
  Calendar,
  MessageCircle,
  Target,
  MoreHorizontal,
  Folder,
  FileText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/ui/Sheet";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const PRIMARY_ITEMS: NavItem[] = [
  { href: "/",       label: "Inicio",  icon: Home,          exact: true },
  { href: "/tasks",  label: "Tareas",  icon: CheckSquare },
  { href: "/agenda", label: "Agenda",  icon: Calendar },
  { href: "/chat",   label: "Chat",    icon: MessageCircle },
  { href: "/focus",  label: "Foco",    icon: Target },
];

const MORE_ITEMS: NavItem[] = [
  { href: "/projects", label: "Proyectos", icon: Folder },
  { href: "/notes",    label: "Notas",     icon: FileText },
  { href: "/settings", label: "Ajustes",   icon: Settings },
];

function NavTab({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
        "transition-colors duration-200",
        isActive
          ? "text-[color:var(--accent)]"
          : "text-[color:var(--text-mute)] hover:text-[color:var(--text-dim)]"
      )}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
      <span className="text-[10px] leading-none">{item.label}</span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className={cn(
          "lg:hidden fixed bottom-0 left-0 right-0 z-40",
          "h-14 flex items-stretch",
          "vibrancy border-t border-[color:var(--border)]",
          "safe-bottom"
        )}
        aria-label="Navegación móvil"
      >
        {PRIMARY_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <NavTab key={item.href} item={item} isActive={isActive} />
          );
        })}

        {/* Botón "Más" */}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="Más opciones"
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
            "text-[color:var(--text-mute)] hover:text-[color:var(--text-dim)]",
            "transition-colors duration-200"
          )}
        >
          <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] leading-none">Más</span>
        </button>
      </nav>

      {/* Sheet "Más" */}
      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Más"
        side="bottom"
      >
        <div className="flex flex-col gap-1">
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-[var(--radius-md)]",
                  "text-sm transition-colors duration-200",
                  isActive
                    ? "text-[color:var(--accent)] bg-[rgba(94,142,255,0.12)]"
                    : "text-[color:var(--text-dim)] hover:bg-[color:var(--surface-2)]"
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
