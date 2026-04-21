# Jarvis v1 Archive

Código rescatado de `/opt/n8n/jarvis-v1-backup/src/` (VPS) antes de limpiar duplicados.

**Fecha de rescate:** 2026-04-21
**Propósito:** Biblioteca de referencia — NO se carga en runtime.

## Qué contiene

### `skills/` (23 skills de dominio v1)
Prompts especializados registrados vía `registerSkill()` del antiguo `core/skill-registry.ts`. Cada skill tenía `triggerKeywords` y un `prompt` de sistema de dominio.

- `ads-strategist.ts` · `branding-personal.ts` · `community-building.ts`
- `comportamiento-humano.ts` · `consultoria-digital.ts` · `copywriter.ts`
- `data-analytics.ts` · `developer.ts` · `ecommerce-ops.ts`
- `estrategia-contenido.ts` · `finanzas-creadores.ts` · `funnels-email.ts`
- `growth-hacking.ts` · `infoproductos.ts` · `neuroventas.ts`
- `productizacion.ts` · `public-speaking.ts` · `seo-posicionamiento.ts`
- `storytelling-avanzado.ts` · `ugc-director.ts` · `ventas-negociacion.ts`
- `viralidad-redes.ts` · `whatsapp-marketing.ts`

**Equivalencia en v2:** el mecanismo existe en `src/core/skill-loader.ts` pero la carpeta `src/roles/` está vacía. Si quieres reactivar, hay que adaptar la API de registro (probablemente ya no es `registerSkill`).

### `config/` (configuración centralizada v1)
- `index.ts` — consolidaba TODAS las env vars en un objeto `config` único (WhatsApp, Obsidian, Perplexity, Resend, Google, GitHub, Stripe, Cal.com, Meta Ads, Gemini, n8n, Kreoon, Services)
- `vault-map.ts` — mapa del vault de Obsidian

**Equivalencia en v2:** prod usa `process.env.*` disperso. Consolidar usando este patrón v1 reduce código duplicado.

### `modules/` (15 módulos funcionales v1)
- `billing` · `content` · `email` · `kreoon` · `media` · `memory`
- `messaging` · `meta-ads` · `obsidian` · `reminders` · `repos`
- `scheduling` · `utilities` · `web`

**Equivalencia en v2:**
- `memory` → portado a `src/agents/memory/`
- `obsidian` → portado a `src/connectors/obsidian-sync.ts`
- `scheduling` → parcialmente en `src/core/scheduler.ts`
- Otros: verificar si lógica se portó a `agents/` o `connectors/`, si no → recuperar de aquí

## Cómo usar

Cuando quieras reactivar un skill o portar lógica de un module:

1. Lee el archivo original aquí
2. Verifica si la API v2 aún es compatible (ej: imports de `../core/*`)
3. Adapta a los patrones actuales de `src/`
4. Crea PR con tests

No hagas `import` directo desde `reference/` — estos archivos pueden tener APIs obsoletas.
