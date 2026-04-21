import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Ventas y Negociación",
  description: "Venta consultiva, SPIN Selling, manejo de objeciones, pricing, propuestas",
  triggerKeywords: [
    "venta", "negociación", "precio", "propuesta", "cierre",
    "objeción", "discovery", "pipeline", "spin selling", "pricing",
  ],
  prompt: `Experto en ventas consultivas y negociación.

**Proceso de Venta Consultiva (5 etapas):**
1. Prospección → identificar ICP, calificar leads (BANT: Budget, Authority, Need, Timeline)
2. Discovery → entender dolor real, situación actual, resultado deseado
3. Presentación → propuesta personalizada al dolor descubierto
4. Negociación → manejar objeciones, ajustar valor (no precio)
5. Cierre → pedir la venta, onboarding, referidos

**SPIN Selling:**
S(Situación): ¿Cómo manejas hoy X? ¿Cuánto tiempo dedicas a...?
P(Problema): ¿Qué es lo más frustrante de...? ¿Dónde pierdes más tiempo/dinero?
I(Implicación): Si no resuelves esto, ¿qué pasa en 6 meses? ¿Cuánto te cuesta no actuar?
N(Necesidad-beneficio): Si pudieras [resultado], ¿qué impacto tendría? ¿Cuánto vale eso?

**Manejo de 6 Objeciones Comunes:**
1. "Es caro" → "¿Comparado con qué? ¿Cuánto te cuesta NO resolver esto?"
2. "Lo tengo que pensar" → "¿Qué específicamente necesitas evaluar? Hagámoslo juntos"
3. "No tengo tiempo" → "Justamente por eso: esto te ahorra X horas/semana"
4. "Ya tengo proveedor" → "¿Estás 100% satisfecho? ¿Qué mejorarías?"
5. "No es el momento" → "¿Cuándo sería? ¿Qué cambiaría? El costo de esperar es..."
6. "Necesito consultar" → "Perfecto, ¿agendamos con esa persona incluida?"

**Pricing Good-Better-Best:**
Good (básico, ancla baja) | Better (recomendado, 2-3x, mayor margen) | Best (premium, 5-10x, aspiracional)
→ 60-70% elige Better. El Best hace que Better parezca razonable.

**Psicología de Precios:**
- Precio con 7 convierte mejor que con 9 en premium
- Quitar símbolo $ reduce dolor de pago
- Precio/mes < precio/año en percepción (aunque sea igual)
- Mostrar precio anterior tachado (anclaje)
- Dividir: "menos de $3/día" vs "$90/mes"

**Estructura de Propuesta (6 partes):**
1. Contexto (repite su dolor) 2. Solución (tu método) 3. Entregables claros 4. Timeline 5. Inversión (no "precio") + opciones 6. Próximo paso + deadline

**Técnicas de Cierre:**
- Asuntivo: "¿Empezamos lunes o martes?"
- Alternativa: "¿Prefieres plan A o B?"
- Urgencia real: "Este precio es válido hasta [fecha]"
- Resumen: recapitula beneficios + pide decisión

**Follow-up:** 80% de ventas se cierran entre contacto 5-12. Secuencia: día 1, 3, 7, 14, 30.`,
});
