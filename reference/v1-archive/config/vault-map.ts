/**
 * Obsidian vault structure — update this when vault structure changes.
 * This is injected into the system prompt for roles with note access.
 */
export const VAULT_MAP = `## Estructura del Vault de Obsidian (ARCHIVOS REALES)
Las áreas son ARCHIVOS .md directamente en \`02 - Areas/\`, NO subcarpetas.
\`\`\`
00 - Inbox/                              → Captura rápida temporal
01 - Proyectos/                          → Proyectos con deadline
02 - Areas/Alexander Cast.md             → Marca personal
02 - Areas/Los Reyes del Contenido.md    → Comunidad
02 - Areas/UGC Colombia.md              → Agencia UGC
02 - Areas/KREOON Tech.md               → Software, tech
02 - Areas/Infiny Latam.md              → Marketing, growth
02 - Areas/Relaciones y Familia.md       → Familia, cumpleaños
02 - Areas/Finanzas.md                   → Deudas, ingresos
02 - Areas/Salud y Bienestar.md          → Salud, ejercicio
02 - Areas/Hogar y Estilo de Vida.md     → Casa, lifestyle
02 - Areas/Desarrollo Personal.md       → Metas personales
02 - Areas/Aprendizaje.md               → Cursos, formación
02 - Areas/Correos y Cuentas.md          → Emails, accesos
02 - Areas/n8n Automations.md            → Automatizaciones
02 - Areas/Claude AI.md                  → Claude config
03 - Recursos/                           → MOCs, referencias
06 - Contenido/                          → Ideas de contenido
07 - Diario/                             → Daily notes (YYYY-MM-DD.md)
\`\`\`

## Reglas de ruteo Obsidian
REGLA #1: SIEMPRE append a notas existentes. NUNCA crear archivos si ya existe la nota del área.
- Familia, cumpleaños → append a \`02 - Areas/Relaciones y Familia.md\`
- Finanzas → append a \`02 - Areas/Finanzas.md\`
- Salud → append a \`02 - Areas/Salud y Bienestar.md\`
- KREOON, tech → append a \`02 - Areas/KREOON Tech.md\`
- Marketing → append a \`02 - Areas/Infiny Latam.md\`
- UGC → append a \`02 - Areas/UGC Colombia.md\`
- Comunidad → append a \`02 - Areas/Los Reyes del Contenido.md\`
- Marca personal → append a \`02 - Areas/Alexander Cast.md\`
- Contenido → crear en \`06 - Contenido/YYYY-MM-DD-titulo.md\`
- Daily → append a \`07 - Diario/YYYY-MM-DD.md\`
- Ideas sueltas → \`00 - Inbox/YYYY-MM-DD-titulo.md\`

## Formato WhatsApp
- *negritas*, _cursivas_, listas simples. Máximo 2-3 párrafos.
- Confirma guardados con "✅ Guardado en [ruta]"`;
