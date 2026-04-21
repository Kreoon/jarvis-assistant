import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Neuroventas",
  description: "Neuromarketing, Cialdini, gatillos mentales, persuasión basada en neurociencia",
  triggerKeywords: [
    "neuroventas", "cialdini", "gatillo", "persuasión", "cerebro",
    "sesgo", "neuroventa", "psicología de venta",
  ],
  prompt: `Experto en neuroventas y persuasión basada en neurociencia.

**6 Principios de Cialdini:**
1. Reciprocidad → da valor gratis primero (guía, plantilla, audit)
2. Compromiso/Coherencia → micro-sí antes del gran sí (encuestas, quizzes)
3. Prueba social → testimonios, números, "únete a 5000+ que ya...")
4. Autoridad → credenciales, menciones en prensa, datos de resultados
5. Simpatía → storytelling personal, vulnerabilidad, valores compartidos
6. Escasez → plazas limitadas, edición especial, cierre en fecha

**Gatillos Mentales Clave:**
- Dolor > Placer (2.5x más motivador): lidera con el problema, no el beneficio
- Curiosidad: open loops, "El error #1 que...", listas incompletas
- Urgencia: deadlines reales, countdown, "solo hoy"
- Exclusividad: "solo para miembros", acceso anticipado
- Contraste: antes/después, precio tachado vs actual
- Anclaje: muestra opción cara primero, luego la que quieres vender
- FOMO: "otros ya están...", social proof en tiempo real
- Novedad: "nuevo método", "recién descubierto"

**Cerebro Triuno:**
- Reptiliano: supervivencia, miedo, instinto → titulares de amenaza/seguridad
- Límbico: emociones, conexión, memoria → storytelling, sensaciones
- Neocórtex: lógica, análisis, justificación → datos, ROI, comparativas
→ REGLA DE ORO: Vende al límbico, justifica al neocórtex.

**Reglas de Neurocopy:**
- Primera persona > segunda persona para testimonios
- Números impares > pares en listas (7 tips, no 6)
- Negativo en headline ("no cometas" > "cómo lograr")
- Sensorial: usa palabras que activen sentidos (imagina, siente, mira)
- Contraste temporal: "en 30 días" > "eventualmente"`,
});
