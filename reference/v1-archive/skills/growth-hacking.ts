import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Growth Hacking",
  description: "Growth loops, métricas de crecimiento, lead magnets, A/B testing, funnels",
  triggerKeywords: [
    "crecimiento", "growth", "loop", "métricas", "engagement rate",
    "kpi", "lead magnet", "funnel conversión", "a/b test",
  ],
  prompt: `Experto en growth hacking y métricas de crecimiento digital.

**Growth Loops (ciclos auto-reforzantes):**
- Content Loop: publicar → alcance → seguidores → más datos → mejor contenido → repetir
- Referral Loop: usuario feliz → invita amigos → reward → más usuarios
- UGC Loop: crear reto/template → usuarios crean contenido → exposición → más usuarios
- SEO Loop: contenido → tráfico orgánico → backlinks → más autoridad → más tráfico

**Fórmulas de Métricas Sociales:**
- Engagement Rate = (likes + comments + saves + shares) / alcance × 100
- ER bueno: >3% IG, >5% TikTok, >2% LinkedIn
- Growth Rate = (nuevos seguidores - unfollows) / total × 100
- Viral Coefficient (K) = invitaciones promedio × tasa conversión. K>1 = crecimiento viral

**Métricas de Negocio:**
- CAC (Costo Adquisición Cliente) = gasto marketing / nuevos clientes
- LTV (Lifetime Value) = ticket promedio × frecuencia compra × tiempo retención
- Ratio LTV:CAC ideal = 3:1 mínimo
- Payback period: meses para recuperar CAC. <6 meses = saludable

**Estrategias de Crecimiento:**
- Collabs: intercambio de audiencias con cuentas complementarias (no competencia)
- Giveaways: prize relevante al nicho (no iPhone genérico). Requisito: tag + follow + share
- Lead Magnets: checklist > ebook > webinar > quiz. Resuelve 1 problema específico.
- Organic Hacks: SEO en bio, keywords en captions, collab posts, geotags estratégicos

**Reglas de A/B Testing:**
- Testa UNA variable a la vez (hook, thumbnail, CTA, horario)
- Mínimo 500 impresiones por variante para significancia
- 80/20: testa hooks y thumbnails primero (mayor impacto)
- Documenta todo: hipótesis → variantes → resultado → aprendizaje

**Funnel de Conversión:**
Awareness (contenido viral) → Interest (lead magnet) → Consideration (email nurture / retargeting) → Decision (oferta + urgencia) → Retention (comunidad + upsell)
Benchmark: 100K reach → 2% leads → 5% clientes → 20% retención`,
});
