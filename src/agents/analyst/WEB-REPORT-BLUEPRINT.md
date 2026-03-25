# Web Report Blueprint — Reemplaza el PDF

## Decisión: Página web en vez de PDF

En vez de generar un PDF (que tiene limitaciones de diseño, emojis rotos, páginas vacías), generamos una **página web pública** en `kreoon.app/r/[id]` que:

- Es shareable (link público = publicidad andante)
- Tiene el video embebido desde Drive
- Incluye teleprompter para grabar
- Tiene copy-paste de captions/hashtags con un click
- Muestra las 3 marcas: Alexander Cast, UGC Colombia, Kreoon
- Diseño profesional responsive con animaciones

---

## Stack Técnico

- **Framework:** Next.js 15 (App Router)
- **Hosting:** Vercel (kreoon.app)
- **Database:** Supabase (tabla `reports` — ya tenemos proyecto configurado)
- **Styling:** Tailwind CSS
- **Animaciones:** Framer Motion
- **Video embed:** Google Drive iframe (`/preview`)

---

## Flujo Completo

```
1. Usuario pega link en WhatsApp
2. Jarvis descarga → Drive → Gemini visión → Claude análisis
3. Jarvis guarda reporte en Supabase (POST /api/reports)
4. Jarvis envía link por WhatsApp: kreoon.app/r/abc123
5. Usuario abre la página → ve TODO el análisis interactivo
```

---

## Base de Datos: Supabase

### Tabla `reports`

```sql
CREATE TABLE reports (
  id                TEXT PRIMARY KEY,           -- nanoid(21)
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ GENERATED ALWAYS AS (created_at + INTERVAL '90 days') STORED,

  -- Contenido original
  platform          TEXT NOT NULL,
  content_type      TEXT NOT NULL,
  original_url      TEXT NOT NULL,
  creator_username  TEXT NOT NULL,
  creator_followers INTEGER,
  duration_seconds  INTEGER,
  caption           TEXT DEFAULT '',
  hashtags          TEXT[] DEFAULT '{}',
  metrics           JSONB DEFAULT '{}',

  -- Media
  drive_video_url   TEXT,
  drive_media_id    TEXT,

  -- Análisis
  gemini_analysis   JSONB DEFAULT '{}',
  strategic_analysis JSONB DEFAULT '{}',
  verdict           JSONB DEFAULT '{}',
  scores            JSONB DEFAULT '{}',

  -- Réplica (nullable — solo opción B)
  wizard_config     JSONB,
  replicas          JSONB,

  -- Producción y publicación
  production_guide  JSONB DEFAULT '{}',
  publish_strategy  JSONB DEFAULT '{}',
  success_metrics   JSONB DEFAULT '{}',
  teleprompter_script TEXT,

  -- Branding
  branding          JSONB DEFAULT '{"show_kreoon": true}'
);

-- RLS: lectura pública, escritura solo service_role
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON reports FOR SELECT USING (true);
```

---

## API Routes

### `POST /api/reports` — Jarvis crea reporte
- Auth: `X-Jarvis-Secret` header
- Genera `id = nanoid(21)`
- Inserta en Supabase con service key
- Retorna: `{ id, url: "https://kreoon.app/r/{id}" }`

### `GET /api/reports/[id]` — Página lee reporte
- Sin auth (público)
- Si expiró → 410 Gone
- Retorna JSON completo del reporte

---

## Estructura de la Página: `/report/[id]`

### Secciones en orden de scroll:

| # | Sección | Descripción |
|---|---------|-------------|
| 1 | **Hero** | Video embebido + plataforma + creator + stats + score general |
| 2 | **Scorecard** | 5 barras animadas (Hook/Copy/Strategy/Production/Virality) + score total |
| 3 | **Análisis Visual** | Lo que vio Gemini: escenas, transcripción, timeline emocional, producción técnica |
| 4 | **12 Dimensiones** | 3 bloques: Estructura (azul), Copy (naranja), Estrategia (verde) — cards expandibles |
| 5 | **Veredicto** | 3 cards: Funciona (verde) / Mejorar (rojo) / Oportunidad (azul) |
| 6 | **Plan de Réplica** | 3 tabs: Fiel / Mejorada / Kreoon UGC — con copy-paste + teleprompter |
| 7 | **Guía Producción** | Checklist, script con tiempos, setup técnico, música |
| 8 | **Publicación** | Mejor día/hora, plan post-publicación, repurposing, calendario |
| 9 | **Métricas** | KPIs, benchmarks, timeline evaluación, Plan B |

### Navegación sticky
- Aparece al hacer scroll pasando el hero
- Links a cada sección con scroll suave
- Sección activa highlighted en naranja

---

## Componentes Clave

### Hero Section
- **Layout:** 2 columnas (60% texto / 40% video) — mobile: video arriba, texto abajo
- **Video:** iframe de Drive en container 9:16 con borde gradiente naranja y sombra
- **Score:** Círculo SVG animado con contador de 0 → score final
- **Stats:** 4 pills (duración, views, likes, ER%) con color coding
- **CTA:** "Ver análisis completo ↓" con glow hover

### Scorecard
- 5 barras horizontales que se animan al entrar en viewport
- Color coding: rojo (<4), naranja (4-6), verde (7-8), oro (9-10)
- Score total grande con badge descriptivo (EXCELENTE/BUENO/MEJORABLE)
- 3 verdict badges rápidos (fortaleza/debilidad/oportunidad)

### Análisis Visual (Gemini)
- **Scene Timeline:** Horizontal scrollable en desktop, vertical en mobile
  - Cada nodo: timestamp, plano, cámara, descripción, texto en pantalla
  - Dot de emoción color-coded
- **Emotional Energy Chart:** Barra SVG mostrando energía por escena
- **Transcripción:** Bloque colapsable con timestamps clickeables
- **Production Specs:** Grid 6 cards (iluminación, audio, calidad, edición, cortes/min, aspecto)

### 12 Dimensiones Estratégicas
- **3 bloques con tabs:** ESTRUCTURA (azul) / COPY (naranja) / ESTRATEGIA (verde)
- **Cada dimensión es una card expandible** (collapsed muestra score + tag, expanded muestra todo)
- Cards especiales:
  - **Hook:** barra score + técnica tags
  - **PASTOR:** diagrama visual de pasos detectados vs faltantes
  - **Gatillos mentales:** tabla 2 columnas (✓ usados / ✗ faltantes)
  - **Cerebro triuno:** 3 barras (reptiliano/límbico/neocórtex) con porcentajes
  - **Funnel:** SVG de embudo con nivel activo highlighted
  - **Pilar contenido:** Donut chart SVG (Educar/Entretener/Inspirar/Vender)
  - **Viralidad:** Score grande + radar chart 5 ejes + patrón viral badge

### Veredicto
- 3 cards lado a lado (desktop) / stacked (mobile)
- Verde: "Qué funciona" con borde izquierdo grueso verde
- Rojo: "Qué mejorar" con borde izquierdo rojo
- Azul: "Oportunidad oculta" con borde izquierdo azul
- ER% vs benchmark abajo

### Plan de Réplica (3 tabs)
- **Tab V1 Fiel:** Hook + Caption (copy-paste cream bg) + Hashtags (pills color-coded) + Producción
- **Tab V2 Mejorada:** Igual + banner verde "Mejoras aplicadas" + gatillos agregados + cambios neurocopy
- **Tab V3 Kreoon UGC:** Igual + StoryBrand visual (6 nodos conectados) + Brief para creator
- **Cada caption tiene botón "Copiar"** → clipboard + toast "Copiado ✓"
- **Cada tab tiene botón "TELEPROMPTER"** → abre modo pantalla completa

### Teleprompter
- **Fullscreen modal** negro con texto blanco grande
- **Auto-scroll** con CSS translateY animado
- **Controles:** play/pause (spacebar/tap), velocidad (slider 1-10), tamaño fuente (S/M/L), espejo
- **Countdown:** 3-2-1-GO antes de empezar
- **Línea guía:** banda naranja horizontal al centro de la pantalla
- **Timestamps** de sección como marcadores `[0:00-0:03] HOOK`
- **Sección activa** resaltada con glow naranja
- **Mobile:** wake lock para que no se apague la pantalla

### Guía de Producción
- **Checklist interactivo** con checkboxes (estado local, no persistido)
- **Script con timeline vertical** — nodos color-coded por sección (hook=rojo, desarrollo=azul, CTA=verde)
- **Setup técnico** en grid 3×2 cards con iconos
- **Música sugerida** con pill de trending sound

### Estrategia de Publicación
- **Mejor momento** card destacado (día + hora + timezone)
- **Timeline post-publicación** vertical (min 0, 1, 5, 30, 60, 120)
- **Tabla transmedia** (8 plataformas × formato × adaptación)
- **Plan semanal** grid de 2 semanas

### Métricas de Éxito
- **KPI Dashboard** grid 4 cards (Views, ER, Saves, Shares) con targets
- **Benchmark comparison** barras horizontales (tu esperado vs promedio vs viral)
- **Timeline evaluación** horizontal (24h → 48h → 7 días → 30 días)
- **Plan B** colapsable con 5 pasos de fallback

---

## Branding (Footer)

### Banner CTA (antes del footer)
- "¿Quieres análisis como este para tu marca?"
- Botón naranja: "Agenda una consulta gratis"
- Links WhatsApp + Instagram
- Tono: natural, no pushy

### Footer (fondo oscuro, 3 columnas)

| Columna 1 | Columna 2 | Columna 3 |
|-----------|-----------|-----------|
| **Alexander Cast** | **UGC Colombia** | **Kreoon** |
| Estratega Digital y de Contenido | Agencia de Creadores | Plataforma de Contenido |
| IG, LinkedIn, TikTok | IG, WhatsApp | kreoon.app |
| → Consultoría 1:1 | → Conectamos marcas con creators | Análisis • Estrategia • Producción |

### Bottom bar
- "Generado por Jarvis AI — Powered by Kreoon"
- Fecha del análisis
- ID del reporte

### Watermark
- "KREOON" en diagonal, 4% opacity, en secciones de análisis
- Invisible al leer, visible en screenshots

---

## Diseño Visual

### Colores
| Token | Hex | Uso |
|-------|-----|-----|
| Kreoon Orange | `#FF6B00` | Headers, acentos, CTAs, barras |
| Dark | `#1a1a1a` / `#0A0A0A` | Fondos hero/footer |
| Text Primary | `#111827` | Texto principal (light mode) |
| Text Secondary | `#666666` | Labels, timestamps |
| Surface | `#F5F5F5` | Cards, fondos |
| Copy-paste bg | `#FFF8F0` | Zonas de copiar (cream) |
| Green | `#2E7D32` | Positivo, funciona |
| Red | `#C62828` | Negativo, mejorar |
| Blue | `#1565C0` | Oportunidad |
| Structure block | `#3B82F6` | Dimensiones de estructura |
| Copy block | `#F97316` | Dimensiones de copy |
| Strategy block | `#22C55E` | Dimensiones de estrategia |

### Tipografía
- **Display:** Inter Black 900 (títulos hero)
- **Headers:** Inter Bold 700 (secciones)
- **Body:** Inter Regular 400 (texto)
- **Mono:** JetBrains Mono (timestamps, código)
- **Teleprompter:** Inter Medium, clamp(24px, 4vw, 48px)

### Animaciones (Framer Motion)
- **Page load:** Hero fade-in → Score circle animado → Stats counter-up (staggered)
- **Scroll:** Cada sección fade-in + slide-up al entrar en viewport
- **Score bars:** Ancho anima de 0 a valor con spring easing
- **Cards:** Scale 0.95→1 con fade-in al entrar en viewport
- **Tabs:** Slide direction-aware (izquierda/derecha) con underline animated
- **Copy buttons:** Flash verde + "Copiado ✓" por 2 segundos + toast
- **Teleprompter:** Countdown 3-2-1-GO + scroll suave + glow en línea activa
- **Dark/Light mode:** Transición suave de 300ms en colores

### Responsive
| Breakpoint | Cambios |
|------------|---------|
| Mobile (<640px) | Video full-width arriba, 1 columna, tabs horizontally scrollable |
| Tablet (640-1024px) | 2 columnas en grids, timeline vertical |
| Desktop (>1024px) | Layout completo, timeline horizontal, 4-col grids |

---

## Archivos del Proyecto Next.js

```
app/
├── r/[id]/
│   ├── page.tsx                 → Server component, fetch + metadata
│   └── ReportPageClient.tsx     → Client component, state management
├── api/
│   └── reports/
│       ├── route.ts             → POST (create from Jarvis)
│       └── [id]/route.ts        → GET (read for page)
components/report/
├── ScrollNavbar.tsx
├── HeroSection.tsx
├── ScorecardSection.tsx
├── VisualAnalysisSection.tsx
├── StrategicAnalysisSection.tsx
├── VerdictSection.tsx
├── ReplicaPlanSection.tsx
├── ProductionGuideSection.tsx
├── TeleprompterModal.tsx
├── PublishingStrategySection.tsx
├── SuccessMetricsSection.tsx
├── ReportFooter.tsx
├── CTABanner.tsx
└── shared/
    ├── SectionHeader.tsx
    ├── CopyButton.tsx
    ├── ScoreBadge.tsx
    └── PlatformIcon.tsx
lib/
├── supabase.ts                  → Client + Admin instances
├── reportApi.ts                 → Fetch/create report functions
└── clipboard.ts                 → Copy utility
types/
└── report.ts                    → Todas las interfaces TypeScript
```

Total: ~25 componentes, 2 API routes, 1 tabla Supabase.

---

## Integración con Jarvis

### Cambio en el Analyst Agent
En vez de generar PDF:
1. Estructura los datos como JSON tipado
2. POST a `https://kreoon.app/api/reports` con los datos
3. Recibe `{ id, url }`
4. Envía el URL por WhatsApp: "📊 Tu reporte: kreoon.app/r/abc123"

### Variables de entorno nuevas en Jarvis
```
REPORT_API_URL=https://kreoon.app/api/reports
JARVIS_INTERNAL_SECRET=<shared-secret>
```

### Variables de entorno en Vercel (kreoon.app)
```
SUPABASE_URL=https://domxgsrajwyuaffiqbtr.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<anon-key>
JARVIS_INTERNAL_SECRET=<same-shared-secret>
```

---

## Skills Integradas

### En el análisis (Secciones 3-5):
- **Comportamiento humano:** Maslow, DISC, Schwartz, Zeigarnik, 7 pecados
- **Neuroventas:** Cialdini, cerebro triuno, neurocopy, dolor vs placer
- **Viralidad:** Fórmula, emociones ranking, patrones virales, métricas 2025-2026
- **Estrategia contenido:** 4 pilares, TOFU/MOFU/BOFU, RICE, PASTOR, repurposing
- **Copywriting:** AIDA/PAS/BAB/4U/ACCA, palabras de poder
- **Growth hacking:** ER benchmarks, funnel benchmarks

### En la réplica (Sección 6):
- **Storytelling:** StoryBrand, Pixar, BAB, PAS extendido, transmedia
- **Creación contenido:** Formatos, guión, brief UGC, setup
- **Branding personal:** Vulnerabilidad estratégica, autoridad ganada

### En publicación (Secciones 7-9):
- **Viralidad redes:** Horarios, engagement, algoritmos
- **Data analytics:** KPIs, benchmarks, evaluación
