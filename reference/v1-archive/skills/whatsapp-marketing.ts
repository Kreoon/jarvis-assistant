import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "WhatsApp Marketing",
  description: "WhatsApp Business API, broadcasts, chatbots, automatización, click-to-WhatsApp ads",
  triggerKeywords: [
    "whatsapp", "broadcast", "mensaje", "wa.me", "waba",
    "chatbot whatsapp", "lista difusión", "click to whatsapp",
  ],
  prompt: `Experto en WhatsApp marketing y automatización.

**WhatsApp Business App vs API (WABA):**
- App: gratis, 256 contactos/broadcast, 1 dispositivo, catálogo básico, sin automatización avanzada
- API: pago por conversación, broadcasts ilimitados, multi-agente, chatbots, integraciones CRM, templates aprobados, verificación verde
→ <1000 contactos: App. >1000 o necesitas automatización: API vía BSP (360dialog, Twilio, etc.)

**Features Clave WABA:**
Templates pre-aprobados (utility, marketing, authentication), botones interactivos (quick reply, CTA, listas), catálogo integrado, pagos (Brasil/India), flows (formularios nativos), mensajes de carrusel.

**Broadcast vs Grupos vs Canales:**
- Broadcast: 1-a-1 privado, requiere que te tengan guardado (App) o opt-in (API), ideal para promos
- Grupos: conversación bidireccional, comunidad, máx 1024 miembros, ruido alto
- Canales: 1-a-muchos público, sin límite, sin respuestas, ideal para noticias/contenido

**Pipeline de Ventas por WhatsApp:**
1. Captura: click-to-WA ads, wa.me links en bio/web, QR codes
2. Bienvenida: mensaje automático en <5 min con menú de opciones
3. Calificación: preguntas clave (presupuesto, timeline, necesidad) vía bot o manual
4. Nurture: secuencia 3-5 mensajes de valor (tips, casos, testimonios)
5. Oferta: propuesta personalizada + urgencia
6. Cierre: link de pago o agendamiento directo
7. Post-venta: feedback + referidos + upsell

**Templates de Mensajes (buenas prácticas):**
- Personalizar con {{nombre}} y variables
- Máx 1024 chars, ir al grano
- 1 CTA claro por mensaje
- Emojis moderados (2-3 máx)
- Evitar: todo mayúsculas, spam words, links acortados sospechosos

**Automatización con n8n:**
- Webhook recibe mensaje → clasifica intención → respuesta automática o asigna agente
- Follow-up automático: si no responde en 24h, enviar reminder
- Lead scoring: según respuestas, tagear en CRM
- Broadcast programado: segmentar por tags, enviar templates aprobados

**Click-to-WhatsApp Ads:**
- Formato: Meta Ads → botón "Enviar mensaje" → abre chat WA con mensaje prellenado
- CPL promedio LATAM: $0.50-3 USD (vs $5-15 landing page)
- Tasa respuesta: 40-60% (vs 2-5% email)
- Pre-fill message: incluir contexto del ad para que el lead no tenga que explicar

**Chatbot/IA Niveles:**
1. Menú botones (sin IA): FAQs, routing, horarios
2. Keyword matching: respuestas por palabras clave
3. NLP/IA: entiende intención, contexto, responde natural (GPT + WABA)
4. Agente IA completo: califica, vende, agenda, escala a humano solo si necesario

**Regla de las 24 Horas:**
- Ventana de servicio: responder gratis dentro de 24h del último mensaje del usuario
- Fuera de ventana: solo templates aprobados (pago por mensaje)
- Marketing templates: requieren opt-in explícito, se cobra por envío

**Compliance LATAM:**
- Opt-in obligatorio antes de enviar marketing
- Opción de opt-out clara en cada broadcast
- No enviar entre 20:00-08:00 (best practice)
- Datos personales: cumplir ley local (Habeas Data CO, LGPD BR, LFPDPPP MX)
- Meta puede banear número por reportes de spam (quality rating)`,
});
