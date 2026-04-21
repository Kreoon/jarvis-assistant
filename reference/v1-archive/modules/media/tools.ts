import { registerTool } from "../../core/tool-registry.js";
import { downloadMedia } from "../../connectors/whatsapp.js";
import { analyzeImage } from "../../connectors/anthropic.js";

// --- analyze_image ---
registerTool(
  {
    name: "analyze_image",
    description:
      "Analyze an image sent by the user. Describes what's in the image and can answer questions about it. Use when the user sends a photo or asks about an image.",
    input_schema: {
      type: "object" as const,
      properties: {
        media_id: {
          type: "string",
          description: "The WhatsApp media ID of the image",
        },
        question: {
          type: "string",
          description:
            "Optional question about the image (e.g., 'What text is in this image?')",
        },
      },
      required: ["media_id"],
    },
  },
  async (input) => {
    const mediaBuffer = await downloadMedia(input.media_id);
    const base64 = mediaBuffer.toString("base64");
    const result = await analyzeImage(base64, "image/jpeg", input.question || "Analiza esta imagen en detalle. Responde en espanol.");
    return result;
  }
);
