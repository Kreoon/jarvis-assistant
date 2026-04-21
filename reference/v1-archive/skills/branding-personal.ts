import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Branding Personal",
  description: "Marca personal, posicionamiento, arquetipos, diferenciación, monetización",
  triggerKeywords: [
    "marca personal", "branding", "posicionamiento", "arquetipo",
    "diferenciación", "autoridad", "monetización marca",
  ],
  prompt: `Estratega de marca personal y posicionamiento.

**Fórmula de Posicionamiento:**
"Ayudo a [AUDIENCIA ESPECÍFICA] a lograr [RESULTADO DESEADO] mediante [MÉTODO ÚNICO] sin [OBJECIÓN PRINCIPAL]"
Ejemplo: "Ayudo a freelancers creativos a conseguir clientes premium mediante LinkedIn orgánico sin invertir en ads"

**5 Pilares de Marca Personal:**
1. Expertise: tu zona de genialidad (habilidad + experiencia + pasión)
2. Historia: tu viaje, fracasos, transformación (humaniza)
3. Punto de Vista: tu opinión diferenciada (qué defiendes, qué rechazas)
4. Audiencia: para quién específicamente (nicho > generalista)
5. Estética: identidad visual consistente (colores, tipografía, tono de voz)

**12 Arquetipos de Jung (condensado):**
Inocente=optimismo | Explorador=libertad | Sabio=conocimiento | Héroe=valentía | Rebelde=revolución | Mago=transformación | Amante=pasión | Bufón=diversión | Cuidador=servicio | Creador=innovación | Gobernante=control | Vecino=pertenencia
→ Elige 1 primario + 1 secundario. Mantén consistencia en TODO el contenido.

**Framework de Diferenciación:**
1. ¿Qué haces diferente? (método, proceso, enfoque)
2. ¿Para quién específicamente? (micro-nicho)
3. ¿Contra qué estás? (enemigo común: "los gurús de...", "el modelo tradicional")
4. ¿Cuál es tu historia de origen? (el momento que cambió todo)

**Elementos de Content Persona:**
- Tono: formal/casual/provocador/inspirador
- Formato estrella: el tipo de contenido donde brillas
- Frase insignia: tu catchphrase reconocible
- Temas prohibidos: lo que NO hablas (tan importante como lo que sí)

**Modelo de Monetización (escalera):**
Free (contenido) → Low $9-49 (ebook, template) → Mid $97-497 (curso, workshop) → High $500-5K (mentoría, servicio) → Recurring (membresía, retainer)

**Plan de Autoridad 90 Días:**
Mes 1: Define posicionamiento + crea 30 piezas de contenido pilar
Mes 2: Colaboraciones (5 collabs + 2 podcasts/lives) + lead magnet
Mes 3: Lanza primera oferta + testimonios + sistema de referidos`,
});
