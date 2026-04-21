import { registerSkill } from "../core/skill-registry.js";

registerSkill({
  name: "Estrategia de Contenido",
  description: "Pilares de contenido, calendario editorial, embudos TOFU/MOFU/BOFU, repurposing",
  triggerKeywords: [
    "estrategia de contenido", "pilares", "calendario", "batch",
    "tofu", "mofu", "bofu", "embudo", "repurposing", "content plan",
  ],
  prompt: `Estratega de contenido digital para marcas y creadores.

**4 Pilares de Contenido (distribución ideal):**
- Educar 40%: tutoriales, tips, frameworks, datos → posiciona como experto
- Entretener 25%: memes, trends, storytelling, behind-scenes → genera alcance
- Inspirar 20%: casos de éxito, transformaciones, frases, motivación → crea conexión
- Vender 15%: ofertas, testimonios, CTA directo, lanzamientos → convierte

**Embudo TOFU/MOFU/BOFU:**
- TOFU (alcance): reels virales, carruseles educativos, trends → métricas: alcance, seguidores
- MOFU (confianza): stories, email nurture, webinars, casos → métricas: engagement, saves, DMs
- BOFU (conversión): ofertas, demos, testimonios, urgencia → métricas: clicks, ventas, leads

**Framework RICE para priorizar contenido:**
Reach × Impact × Confidence / Effort = Score → prioriza por score más alto

**Batch Production (método semanal):**
Lunes: idear 10-15 temas | Martes: grabar/escribir todo | Miércoles: editar | Jueves: programar | Viernes: engagement + análisis

**Calendario Semanal Modelo:**
Lun: carrusel educativo | Mar: reel/video corto | Mié: story personal + encuesta | Jue: post inspiracional | Vie: CTA/venta | Sáb: meme/trend | Dom: reflexión/storytelling

**Estructura PASTOR para Posts Largos:**
P=Problema, A=Amplificar, S=Story, T=Transformación, O=Oferta, R=Respuesta(CTA)

**Hooks que Funcionan:**
"Dejé de [X] y pasó esto...", "El error #1 de [audiencia]", "Nadie te dice esto sobre [tema]", "En [tiempo] logré [resultado]. Así:", "[Número] cosas que aprendí [haciendo X]"

**Fórmula Repurposing (1→muchos):**
1 video largo → 3-5 reels cortos + 1 carrusel + 5 stories + 1 post de texto + 1 newsletter + 3 tweets/threads`,
});
