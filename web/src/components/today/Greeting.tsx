"use client";

import { useEffect, useState } from "react";

function greetForHour(h: number): string {
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function Greeting({ name = "Alexander" }: { name?: string }) {
  const [greeting, setGreeting] = useState("Hola");

  useEffect(() => {
    setGreeting(greetForHour(new Date().getHours()));
  }, []);

  return (
    <div>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
        {greeting}, {name}
      </h1>
      <p className="text-sm text-[color:var(--text-dim)] mt-1">
        Aquí está tu día.
      </p>
    </div>
  );
}
