"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Separator } from "@/components/ui/Separator";
import { useInstallPrompt } from "@/contexts/InstallPromptContext";

function IOSInstallInstructions() {
  return (
    <div className="space-y-2">
      <p className="text-sm text-[color:var(--text-dim)]">
        Para instalar Jarvis en iOS Safari:
      </p>
      <ol className="text-sm text-[color:var(--text-dim)] list-decimal list-inside space-y-1">
        <li>
          Toca el botón{" "}
          <span className="text-[color:var(--text)] font-medium">Compartir</span>{" "}
          <span aria-label="ícono compartir">⬆</span> en la barra inferior
        </li>
        <li>
          Desplázate y selecciona{" "}
          <span className="text-[color:var(--text)] font-medium">
            Añadir a pantalla de inicio
          </span>
        </li>
        <li>
          Toca{" "}
          <span className="text-[color:var(--text)] font-medium">Añadir</span>{" "}
          para confirmar
        </li>
      </ol>
    </div>
  );
}

function AppSection() {
  const { canInstall, promptInstall, isInstalled } = useInstallPrompt();

  return (
    <section aria-labelledby="app-section-title" className="space-y-4">
      <h2
        id="app-section-title"
        className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-dim)]"
      >
        Aplicación
      </h2>
      <Card variant="default" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-[color:var(--text)]">
              Instalar Jarvis
            </p>
            <p className="text-xs text-[color:var(--text-dim)]">
              Accede desde tu pantalla de inicio sin abrir el navegador
            </p>
          </div>

          {isInstalled ? (
            <span className="text-sm text-[color:var(--text-dim)] whitespace-nowrap">
              Ya está instalada
            </span>
          ) : canInstall ? (
            <Button
              variant="primary"
              size="sm"
              onClick={promptInstall}
              aria-label="Instalar Jarvis como app en este dispositivo"
              className="shrink-0"
            >
              Instalar
            </Button>
          ) : null}
        </div>

        {!isInstalled && !canInstall && (
          <>
            <Separator />
            <IOSInstallInstructions />
          </>
        )}
      </Card>
    </section>
  );
}

function AboutSection() {
  return (
    <section aria-labelledby="about-section-title" className="space-y-4">
      <h2
        id="about-section-title"
        className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-dim)]"
      >
        Acerca de
      </h2>
      <Card variant="default" className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[color:var(--text-dim)]">Versión</span>
          <span className="text-sm font-medium text-[color:var(--text)]">
            Jarvis v2.0
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm text-[color:var(--text-dim)]">Repositorio</span>
          <a
            href="https://github.com/AlexanderKast/jarvis-assistant"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[color:var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] focus-visible:outline-offset-2 rounded-sm"
            aria-label="Abrir repositorio de Jarvis en GitHub (abre en nueva pestaña)"
          >
            GitHub
          </a>
        </div>
      </Card>
    </section>
  );
}

export default function SettingsPage() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-[color:var(--text)]">
          Ajustes
        </h1>
      </header>
      <AppSection />
      <AboutSection />
    </main>
  );
}
