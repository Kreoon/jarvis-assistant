import { downloadMedia } from "../../connectors/whatsapp.js";
import { analyzeImage } from "../../connectors/anthropic.js";

/**
 * Process media by type
 * Image -> analyzeImage via Anthropic vision
 * Audio -> returns empty (handled separately by transcriber)
 */
export async function processMedia(
  mediaId: string,
  mimeType: string
): Promise<string> {
  if (mimeType.startsWith("image/")) {
    const mediaBuffer = await downloadMedia(mediaId);
    const base64 = mediaBuffer.toString("base64");
    return analyzeImage(base64, mimeType, "Analiza esta imagen en detalle. Responde en español. Describe qué es, texto visible, y contexto.");
  }

  if (mimeType.startsWith("audio/")) {
    // Audio is handled separately by the transcriber pipeline
    return "";
  }

  return `Unsupported media type: ${mimeType}`;
}
