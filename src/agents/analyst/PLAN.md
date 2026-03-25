# Agent Analyst — Plan de Implementación v2

## Arquitectura actualizada

```
WhatsApp → Core Agent → detecta URL de red social → Agent Analyst
                                    │
                                    ├── extract_content (yt-dlp + instaloader)
                                    │       └── upload a Google Drive (Jarvis/Analyst/Media/)
                                    │       └── borrar del VPS
                                    │
                                    ├── analyze_strategy (LLM + 12 dimensiones + 7 skills)
                                    │
                                    ├── wizard_replicate (3 preguntas cortas)
                                    │
                                    ├── replicate_content (3 versiones)
                                    │
                                    ├── generate_pdf (PDFKit → Google Drive)
                                    │       └── Jarvis/Analyst/Reportes/[fecha]-[tema].pdf
                                    │       └── envía link por WhatsApp
                                    │
                                    ├── extract_profile (batch últimos 10-20 posts)
                                    │
                                    └── batch_analyze (reporte de estrategia completo)
```

## Archivos a crear/modificar

### Nuevos
1. `src/agents/analyst/index.ts` — Agente con 7 tools + system prompt mega
2. `src/connectors/social-extractor.ts` — yt-dlp + instaloader wrapper
3. `src/connectors/google-drive.ts` — Upload/download/list via Google Drive API
4. `src/connectors/pdf-generator.ts` — Genera PDFs estructurados con PDFKit

### Modificar
5. `src/core/router.ts` — Agregar analyst al routing + detección de URLs
6. `src/agents/core/index.ts` — Agregar route a analyst en system prompt + tools
7. `Dockerfile` — Agregar python3, yt-dlp, instaloader, ffmpeg
8. `package.json` — Agregar pdfkit, @types/pdfkit

## Dependencias nuevas

### npm
- `pdfkit` — Generación de PDFs
- `@types/pdfkit` — Types

### Sistema (Dockerfile)
- `python3` + `pip3`
- `yt-dlp` (TikTok, YouTube, Facebook, Twitter/X)
- `instaloader` (Instagram)
- `ffmpeg` (procesamiento media)

## Tools del Agent Analyst

### 1. `extract_content`
```
Input: { url: string }
Output: ExtractedContent (media en Drive, link devuelto)
```
- Detecta plataforma por URL pattern
- Descarga con yt-dlp o instaloader
- Sube archivo a Google Drive → Jarvis/Analyst/Media/
- Borra archivo local
- Retorna metadata + link de Drive

### 2. `analyze_strategy`
```
Input: { content: ExtractedContent }
Output: { analysis: 12 dimensiones completas }
```
- Usa el system prompt con las 12 dimensiones
- Aplica frameworks de las 7 skills
- Retorna análisis formateado

### 3. `start_wizard`
```
Input: { analysis_id: string }
Output: { questions: 3 preguntas del wizard }
```
- Inicia el wizard de 3 preguntas
- Guarda estado en memoria del agente
- Espera respuesta del usuario

### 4. `replicate_content`
```
Input: { analysis: object, topic: string, objective: string, platform: string }
Output: { versions: [fiel, mejorada, kreoon] }
```
- Genera 3 versiones con todo el detalle
- Aplica skills de copywriting, neuroventas, storytelling

### 5. `generate_pdf`
```
Input: { analysis: object, replicas: object, wizard_answers: object }
Output: { driveUrl: string, fileName: string }
```
- Genera PDF estructurado con PDFKit
- 5 secciones: Análisis, Plan de Réplica, Guía Producción, Estrategia Publicación, Métricas
- Sube a Google Drive → Jarvis/Analyst/Reportes/
- Retorna link

### 6. `extract_profile`
```
Input: { username: string, platform: string, count?: number }
Output: { posts: ExtractedContent[], profile: ProfileInfo }
```
- Extrae últimos 10-20 posts de un perfil
- Media de cada post → Google Drive

### 7. `batch_analyze`
```
Input: { posts: ExtractedContent[], profile: ProfileInfo }
Output: { report: BatchReport }
```
- Analiza todo el perfil
- Genera reporte + PDF

## Google Drive Setup

### Estructura de carpetas
```
Jarvis/
├── Analyst/
│   ├── Media/          → archivos descargados
│   │   ├── instagram/
│   │   ├── tiktok/
│   │   ├── youtube/
│   │   └── twitter/
│   └── Reportes/       → PDFs generados
│       └── 2026-03-17-coaching-financiero.pdf
```

### Autenticación
Reusar el Google OAuth de founder@kreoon.com que ya está configurado.
Google Drive API scope: `https://www.googleapis.com/auth/drive.file`
Puede requerir agregar este scope al OAuth consent screen.

## Flujo conversacional WhatsApp

```
USUARIO: [pega link de Instagram reel]

JARVIS: 🤔 → extrae contenido → sube a Drive → analiza

JARVIS: 🔍 ANÁLISIS: "Cómo gané $10K con UGC"
        [12 dimensiones completas]
        ¿Quieres que replique este contenido? 🎯

USUARIO: sí

JARVIS: 📋 WIZARD DE RÉPLICA
        1️⃣ ¿Tema/marca?
        2️⃣ ¿Objetivo? (a) Alcance (b) Leads (c) Venta (d) Autoridad
        3️⃣ ¿Plataforma destino?

USUARIO: coaching financiero, leads, Instagram

JARVIS: 🔄 RÉPLICA: coaching financiero
        [3 versiones completas]
        📄 PDF: [link Drive]

--- BATCH MODE ---

USUARIO: analiza el perfil de @garyvee

JARVIS: 🤔 → extrae últimos 15 posts → analiza batch

JARVIS: 📊 REPORTE: @garyvee
        [análisis completo de estrategia]
        📄 PDF reporte: [link Drive]
```

## Orden de implementación

1. `src/connectors/google-drive.ts` — Upload media + PDFs
2. `src/connectors/social-extractor.ts` — yt-dlp + instaloader
3. `src/connectors/pdf-generator.ts` — PDFKit
4. `src/agents/analyst/index.ts` — El agente completo
5. Actualizar router + core agent
6. Actualizar Dockerfile
7. Build + deploy en VPS
8. Test con link real de Instagram
