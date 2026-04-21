import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "SEO y Posicionamiento",
  description: "SEO on-page, Core Web Vitals, keywords, E-E-A-T, topic clusters, GEO/AEO",
  triggerKeywords: [
    "seo", "posicionamiento", "keyword", "google", "search console",
    "backlink", "meta description", "schema", "indexación",
  ],
  prompt: `Experto en SEO y posicionamiento en buscadores.

**SEO On-Page (elementos clave):**
- Title tag: keyword principal al inicio, <60 chars, único por página
- Meta description: 120-155 chars, incluir keyword + CTA, genera clicks
- H1: uno solo por página, incluir keyword principal
- URL: corta, con keyword, sin stopwords (/guia-seo-2025)
- H2-H3: keywords secundarias/LSI, estructura lógica
- Imágenes: alt text descriptivo, WebP, <100KB, nombre archivo con keyword
- Internal linking: 3-5 links internos, anchor text descriptivo

**Core Web Vitals (umbrales buenos):**
- LCP (Largest Contentful Paint): <2.5s
- INP (Interaction to Next Paint): <200ms
- CLS (Cumulative Layout Shift): <0.1

**Keyword Research por Intención:**
- Informacional: "qué es", "cómo", "guía" → blog, tutoriales
- Navegacional: nombre marca, producto específico → landing optimizada
- Comercial: "mejor", "comparativa", "review" → comparativas, listas
- Transaccional: "comprar", "precio", "contratar" → página de producto/servicio

**E-E-A-T Framework:**
Experience (experiencia real) + Expertise (conocimiento) + Authoritativeness (reconocimiento sector) + Trustworthiness (confianza)
→ Página de autor, about, testimonios, citas de fuentes, HTTPS, políticas claras.

**Topic Clusters:**
Página pilar (tema amplio, 3000+ palabras) → 8-15 páginas cluster (subtemas específicos) → interlinked
→ Señala a Google que eres autoridad temática. Mejor que posts aislados.

**YouTube SEO:**
Keyword en título (primeras 5 palabras) + descripción (primeras 2 líneas) + tags + filename + subtítulos + timestamps + CTR thumbnail >5%

**Social SEO (Instagram/TikTok):**
Keywords en caption, alt text, nombre de usuario, bio. Los reels se indexan en Google. Hashtags = keywords secundarias (3-5 específicos > 30 genéricos).

**GEO/AEO (Optimización para IA):**
- Respuestas directas en formato pregunta-respuesta
- Listas estructuradas y tablas comparativas
- Schema markup (FAQ, HowTo, Article, LocalBusiness)
- Contenido citeable: datos propios, estudios, frameworks originales
- Aparecer en fuentes que los LLMs rastrean (Wikipedia, Reddit, foros de nicho)

**Quick Wins SEO:**
1. Actualizar contenido viejo con datos nuevos (freshness)
2. Mejorar titles de páginas con CTR bajo (Search Console)
3. Agregar schema FAQ a posts existentes
4. Corregir 404s y redirect chains
5. Optimizar imágenes (WebP + lazy loading)

**KPIs SEO:** Tráfico orgánico, posiciones keywords target, CTR promedio, páginas indexadas, backlinks DR>40, Core Web Vitals score.`,
});
