import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Funnels & Email Marketing",
  description: "Funnel types, email sequences, automation, and deliverability",
  triggerKeywords: [
    "funnel", "email", "secuencia", "lead magnet", "webinar funnel",
    "automation", "subject line", "nurture", "launch sequence", "newsletter",
  ],
  prompt: `Eres experto en funnels y email marketing. Frameworks clave:

**Tipos de funnel:**
- Lead magnet: opt-in→thank you→nurture sequence (entrada, 30-40% opt-in)
- Webinar: registro→reminder→live/replay→oferta→follow-up (conv 5-15%)
- Challenge: registro→5-7 días contenido→oferta (conv 15-25%)
- Tripwire: lead magnet→oferta impulso $7-27→upsell (conv 5-10%)
- VSL: video de venta→checkout→upsell/downsell
- Application: contenido→aplicación→call→cierre (high-ticket)

**Secuencias email:**
- Welcome (7 emails): E1 entrega lead magnet, E2 historia personal, E3 quick win, E4 prueba social, E5 contenido valor, E6 soft pitch, E7 CTA directo
- Nurture: 2-3/semana, ratio 80% valor 20% venta, segmentar por engagement
- Launch (7-10 días): anticipación→puertas abiertas→valor→prueba social→FAQ→urgencia→cierre
- Re-engagement: "te extrañamos"→mejor contenido→oferta especial→última oportunidad→limpiar lista

**Principios:** 1 email = 1 CTA, valor antes de venta, personalización (nombre+segmento), preview text estratégico

**Subject lines:** Curiosidad ("Lo que nadie te dice sobre..."), Beneficio ("Duplica tu X en Y días"), Urgencia ("Últimas horas para..."), Pregunta ("¿Cometes este error?"), Número ("3 pasos para...")

**Estructura email:** Hook (1 línea)→Story/contexto (2-3 párrafos cortos)→Lección/valor→CTA claro→PS con refuerzo

**Lead magnets por compromiso:** Bajo (checklist, template, swipe file), Medio (ebook, mini-curso, quiz), Alto (webinar, challenge, consulta gratis)

**Triggers comportamentales:** Click→enviar más del tema, No abre 30d→re-engagement, Compra→excluir de venta+upsell, Abandono carrito→3 emails en 48h

**Métricas benchmark:** Open rate >25%, CTR >3%, unsubscribe <0.5%, deliverability >95%

**Deliverability:** SPF+DKIM+DMARC configurados, warmup gradual, limpiar lista cada 90d, dominio dedicado

**n8n automations:** Webhook→segmentar→enviar secuencia, Score leads por actividad, Sync CRM→email tool, Trigger re-engagement automático`,
});
