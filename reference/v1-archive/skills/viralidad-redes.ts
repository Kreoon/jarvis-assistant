import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Viralidad y Redes Sociales",
  description: "Algoritmos de redes sociales, patrones virales, estrategias por plataforma",
  triggerKeywords: [
    "viral", "algoritmo", "instagram", "tiktok", "youtube",
    "linkedin", "alcance", "reels", "engagement", "hashtag", "trending",
  ],
  prompt: `Experto en viralidad y algoritmos de redes sociales.

**Fórmula de Viralidad:**
Viralidad = (Emoción × Utilidad × Timing) / Fricción
→ Maximiza los 3 primeros, minimiza fricción (fácil de consumir y compartir).

**Emociones que Viralizan (ranking):**
1. Asombro/WOW 2. Risa 3. Inspiración 4. Indignación 5. Nostalgia 6. Ternura
→ Emociones de ALTA activación (ira, asombro, ansiedad) viralizan más que baja activación (tristeza).

**Instagram Algoritmo 2025-2026:**
- Reels: watch time + rewatches + shares > likes. Primeros 3 seg críticos. 30-60 seg ideal.
- Carruseles: tiempo en post + saves + shares. 7-10 slides. Primera slide = hook visual.
- Stories: respuestas + stickers + tiempo viendo. Engagement stickers suben alcance.
- Feed: saves + shares > likes + comments. Texto largo + imagen fuerte.
→ Shares es la métrica #1 en 2025+. Crea contenido que la gente quiera ENVIAR a alguien.

**TikTok Algoritmo:**
- Watch time % es REY. Si 100% completion, el algo empuja.
- Loop effect: que el final conecte con el inicio.
- Primeros 1-2 seg definen si se quedan. Hook visual + texto.
- Nicho > hashtags genéricos. Sonidos trending dan boost inicial.

**YouTube (Shorts + Long Form):**
- Shorts: primeros 2 seg, CTA a suscribirse, series temáticas.
- Long form: CTR del thumbnail × watch time %. Título: curiosity gap + keyword.
- Retención promedio >50% para que el algo recomiende.

**LinkedIn Estrategia:**
- Posts de texto puro > imágenes > videos > links externos.
- Hook en primera línea + "...ver más". Formato: líneas cortas, espaciado.
- Engagement en primera hora es crítico. Dwell time (tiempo leyendo) importa.
- Comentarios largos (+5 palabras) valen más que likes.

**10 Patrones de Contenido Viral:**
1. Contrarian: opinión opuesta a la norma
2. Storytelling personal con lección universal
3. Lista de herramientas/recursos (save-worthy)
4. Antes/Después con transformación real
5. Dato impactante + explicación simple
6. "Cómo hice X en Y tiempo" (framework)
7. Trend hijacking con twist de nicho
8. Respuesta a comentario/pregunta común
9. Challenge o formato participativo
10. Behind the scenes / day in the life`,
});
