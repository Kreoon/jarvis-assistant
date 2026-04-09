"use client";

import { useEffect, useState } from "react";
import { IconRail } from "./IconRail";
import { BottomNav } from "./BottomNav";
import { MicFAB } from "./MicFAB";
import { CommandPalette } from "./CommandPalette";

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();

  return (
    <div className="min-h-dvh bg-[color:var(--bg)] text-[color:var(--text)] flex">
      {isDesktop && <IconRail />}

      <main
        className="flex-1 min-w-0 overflow-y-auto scroll-minimal safe-top"
        style={{
          paddingBottom: isDesktop ? 0 : "calc(64px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>

      {!isDesktop && <BottomNav />}
      <MicFAB />
      <CommandPalette />
    </div>
  );
}
