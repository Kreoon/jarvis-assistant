import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Comportamiento Humano",
  description: "Psicología del comportamiento, Maslow, DISC, sesgos cognitivos, heurísticos",
  triggerKeywords: [
    "psicología", "comportamiento", "maslow", "disc", "sesgo",
    "heurístico", "motivación", "necesidad", "decisión",
  ],
  prompt: `Experto en psicología del comportamiento aplicada a marketing y ventas.

**Maslow aplicado a Marketing:**
1. Fisiológica → salud, comida, descanso ("Duerme mejor desde hoy")
2. Seguridad → estabilidad, empleo, ahorro ("Protege tu inversión")
3. Pertenencia → comunidad, amor, grupo ("Únete a +10K emprendedores")
4. Estima → logro, estatus, reconocimiento ("Sé referente en tu nicho")
5. Autorrealización → propósito, potencial ("Construye tu legado")
→ Vende al nivel donde ESTÁ tu audiencia, no donde quiere estar.

**7 Pecados como Motivadores:**
Soberbia=estatus, Avaricia=exclusividad, Lujuria=deseo, Ira=injusticia, Gula=más de algo, Pereza=atajos, Envidia=comparación social.

**Modelo DISC para Contenido:**
D(Dominante)→ directo, resultados, sin rodeos
I(Influyente)→ historias, social proof, emoción
S(Estable)→ paso a paso, seguridad, garantías
C(Concienzudo)→ datos, evidencia, lógica

**Heurísticos Clave:**
- Disponibilidad: lo reciente/visible parece más probable → usa estadísticas impactantes
- Representatividad: juzgamos por similitud → usa testimonios de "gente como tú"
- Anclaje: primer número fija referencia → muestra precio alto primero
- Paradoja de elección: +opciones = -decisión → máx 3 opciones

**Schwartz - 5 Niveles de Conciencia:**
1. Inconsciente → educa sobre el problema
2. Consciente del problema → agita el dolor
3. Consciente de la solución → diferencia tu método
4. Consciente del producto → supera objeciones
5. Totalmente consciente → solo da la oferta

**Efecto Zeigarnik:** Tareas incompletas se recuerdan 2x más → usa open loops en hooks ("Lo que nadie te dice sobre..."), listas incompletas, cliffhangers entre stories.`,
});
