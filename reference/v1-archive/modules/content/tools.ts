import { registerTool } from "../../core/tool-registry.js";
import { haikuComplete } from "../../connectors/anthropic.js";

// --- generate_content_plan ---
registerTool(
  {
    name: "generate_content_plan",
    description:
      "Generate a content plan for social media (Instagram, TikTok, LinkedIn). Use when the user asks for content ideas, a content calendar, or a posting plan for any of the 5 pillars.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description:
            "The topic or theme for the content plan (e.g., 'UGC trends', 'personal branding')",
        },
        platform: {
          type: "string",
          enum: ["instagram", "tiktok", "linkedin", "youtube", "all"],
          description: "Target platform. Default 'all'.",
        },
        days: {
          type: "number",
          description: "Number of days to plan for. Default 7.",
        },
        pillar: {
          type: "string",
          enum: [
            "Alexander Cast",
            "Los Reyes del Contenido",
            "UGC Colombia",
            "KREOON Tech",
            "Infiny Latam",
          ],
          description: "Which business pillar this content is for",
        },
      },
      required: ["topic"],
    },
  },
  async (input) => {
    const platform = input.platform || "all";
    const days = input.days || 7;
    const pillar = input.pillar || "general";

    const result = await haikuComplete(
      `Eres un estratega de contenido digital experto en Latinoamerica. Genera un plan de contenido para ${days} dias.

Tema: ${input.topic}
Plataforma: ${platform}
Marca/Pilar: ${pillar}

Para cada dia incluye:
- Tipo de contenido (reel, carrusel, story, post, etc.)
- Idea/concepto breve
- Hook o titulo sugerido
- Hashtags relevantes (3-5)

Formato limpio para WhatsApp. Se conciso.`
    );

    return result;
  }
);

// --- write_caption ---
registerTool(
  {
    name: "write_caption",
    description:
      "Write a social media caption/copy for a post. Use when the user asks to write a caption, post copy, or needs text for social media.",
    input_schema: {
      type: "object" as const,
      properties: {
        idea: {
          type: "string",
          description: "The idea or topic for the caption",
        },
        platform: {
          type: "string",
          enum: ["instagram", "tiktok", "linkedin", "twitter"],
          description: "Target platform. Default 'instagram'.",
        },
        tone: {
          type: "string",
          description:
            "Tone of voice (e.g., 'professional', 'casual', 'inspirational', 'educational'). Default 'casual'.",
        },
        include_cta: {
          type: "boolean",
          description: "Include a call-to-action. Default true.",
        },
      },
      required: ["idea"],
    },
  },
  async (input) => {
    const platform = input.platform || "instagram";
    const tone = input.tone || "casual";
    const cta = input.include_cta !== false;

    const result = await haikuComplete(
      `Escribe un caption para ${platform} con tono ${tone}.

Idea: ${input.idea}

Reglas:
- Maximo 2200 caracteres para Instagram, 150 para Twitter
- Empieza con un hook fuerte
- ${cta ? "Incluye un call-to-action al final" : "Sin call-to-action"}
- Agrega 3-5 hashtags relevantes al final
- Usa emojis estrategicamente (no excesivos)
- Escribe en espanol

Devuelve SOLO el caption listo para copiar y pegar.`
    );

    return result;
  }
);

// --- generate_hashtags ---
registerTool(
  {
    name: "generate_hashtags",
    description:
      "Generate relevant hashtags for a social media post. Use when the user asks for hashtags for a specific topic or post.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: {
          type: "string",
          description: "The topic or content description",
        },
        platform: {
          type: "string",
          enum: ["instagram", "tiktok", "linkedin"],
          description: "Target platform. Default 'instagram'.",
        },
        count: {
          type: "number",
          description: "Number of hashtags to generate. Default 15.",
        },
      },
      required: ["topic"],
    },
  },
  async (input) => {
    const platform = input.platform || "instagram";
    const count = input.count || 15;

    const result = await haikuComplete(
      `Genera ${count} hashtags para ${platform} sobre: ${input.topic}

Reglas:
- Mezcla hashtags de alto volumen (>100K posts), medio (10K-100K), y nicho (<10K)
- Incluye hashtags en espanol y en ingles
- Relevantes para el mercado latinoamericano
- Formato: lista separada por espacios, cada uno con #
- Devuelve SOLO los hashtags, nada mas.`
    );

    return result;
  }
);
