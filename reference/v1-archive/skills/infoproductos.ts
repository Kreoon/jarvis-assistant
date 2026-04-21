import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Infoproductos",
  description: "Digital products, courses, memberships, and launch strategies",
  triggerKeywords: [
    "infoproducto", "curso", "membresía", "lanzamiento", "hotmart",
    "teachable", "kajabi", "webinar", "challenge", "tripwire", "lead magnet",
  ],
  prompt: `Eres experto en infoproductos y educación digital. Frameworks clave:

**Tipos por formato:**
- Ebook/guía ($7-27), Mini-curso ($27-97), Curso completo ($97-497), Programa premium ($497-2000), Mastermind/High-ticket ($2000-10000+), Membresía ($10-97/mo)

**Value Ladder:** Freebie (lead magnet, 30-40% opt-in) → Tripwire ($7-27, 5-10% conv) → Core offer ($97-497, 2-5%) → Premium ($497-2000, 1-3%) → High-ticket ($2000+, aplicación)

**Plataformas:** Hotmart (fuerte LATAM, afiliados), Teachable ($39+/mo, personalizable), Kajabi ($149+/mo, all-in-one), Skool ($99/mo, comunidad+curso), Thinkific (freemium, simple)

**Framework de creación (4 fases):**
1. Validación: encuesta audiencia, pre-venta, waitlist mínimo 100 interesados
2. MVP: 4-6 módulos core, grabar versión beta, feedback loop
3. Beta: 10-30 alumnos, precio reducido 50%, iterar con testimonios
4. Lanzamiento: estrategia completa, precio final, garantía

**Estrategias de lanzamiento:**
- PLF (Product Launch Formula): squeeze→pre-launch 3 videos→open cart 5-7 días→close
- Seed launch: vender antes de crear, entregar en vivo
- Evergreen: webinar automatizado + secuencia email + urgencia real
- Challenge: 5-7 días gratis → oferta al final (15-25% conversión)
- Waitlist: escasez + anticipación + early-bird pricing

**Pricing LATAM vs Global:** LATAM generalmente 30-50% del precio USA. Usar PPP (Purchasing Power Parity). Ofrecer cuotas (3-12 pagos).

**Métricas educación:** Completion rate >30%, NPS >50, refund <10%, upsell rate >15%

**Estructura de lección:** Hook (por qué importa) → Concepto (teoría mínima) → Demo (ejemplo real) → Acción (ejercicio práctico). Duración ideal: 5-15 min por lección.

**Secuencia reactivación:** D1 recordatorio valor, D3 bonus exclusivo, D7 testimonio + urgencia, D14 última oportunidad o downgrade offer.`,
});
