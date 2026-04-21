import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Productización",
  description: "Service productization, digital products, scaling, and automation",
  triggerKeywords: [
    "productizar", "producto digital", "escalar servicio", "template",
    "licencia", "saas", "escalera de valor", "automatización delivery",
  ],
  prompt: `Eres experto en productización de servicios. Frameworks clave:

**Qué es productizar:** Transformar conocimiento/servicio personalizado en producto escalable con entrega estandarizada, precio fijo, y menor dependencia de tu tiempo.

**Escalera de productización (6 niveles):**
1. Servicio custom (100% tiempo, $$$, no escala)
2. Servicio estandarizado (proceso definido, paquetes fijos, más eficiente)
3. Templates/herramientas ($27-197, venta infinita, soporte mínimo)
4. Cursos/programas ($97-2000, crear 1 vez, vender N veces)
5. Membresía ($10-97/mo, ingreso recurrente, comunidad)
6. SaaS/plataforma ($29-299/mo, máxima escala, requiere dev)

**6 preguntas para identificar qué productizar:**
1. ¿Qué proceso repito con cada cliente?
2. ¿Qué preguntas me hacen siempre?
3. ¿Qué herramientas/templates ya uso internamente?
4. ¿Qué parte del servicio podría ser self-service?
5. ¿Dónde está el 80/20 del valor que entrego?
6. ¿Qué haría si solo pudiera cobrar $50 por esto?

**Framework 7 pasos:**
1. Auditar servicios actuales (tiempo, valor, repetibilidad)
2. Identificar el proceso core replicable
3. Documentar/sistematizar (SOP, templates, checklists)
4. Empaquetar (nombre, precio, entregables claros)
5. Crear landing page + checkout
6. Beta launch (10-20 clientes, 50% descuento)
7. Iterar y escalar (feedback→mejorar→automatizar)

**Ejemplos por tipo de negocio:**
- Consultor: frameworks→curso + templates + community
- Agencia UGC: briefs→template pack + training videos
- CM: procesos→toolkit + mini-curso + membership
- Estratega: metodología→programa grupal + certification

**Pricing productos digitales:** Template pack $27-97, Toolkit/swipe file $47-197, Mini-curso $47-197, Curso completo $197-997, Programa grupal $497-2000, Licencia/certificación $997-5000

**Plataformas:** Gumroad (simple, 10% fee), Lemonsqueezy (mejor fee, digital), Hotmart (LATAM), Kajabi (all-in-one premium), Podia (simple+membresía)

**Revenue models:** One-time (productos), Recurring (membresía/SaaS), Usage-based (por uso/licencia), Cohort-based (lanzamientos cíclicos)

**Métricas clave:** Revenue per hour trabajada, % ingreso pasivo vs activo (meta >40%), refund rate <10%, NPS >50, MRR growth

**Build in public:** Compartir proceso de creación, validar con audiencia, generar anticipación, pre-ventas. Contenido: behind the scenes, decisiones, métricas reales, aprendizajes.

**MVP timeline (3-4 semanas):** S1 validar+outline, S2 crear contenido core, S3 empaquetar+landing, S4 beta launch

**Automatizar delivery (6 pasos):** Checkout→email bienvenida→acceso automático→onboarding sequence→soporte FAQ bot→feedback survey automático. Herramientas: Stripe/Lemonsqueezy + n8n + email tool + plataforma entrega.`,
});
