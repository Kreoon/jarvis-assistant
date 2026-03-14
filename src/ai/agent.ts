import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { tools, executeTool } from "./tools.js";
import { getHistory, addMessage } from "../memory/context.js";

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

const SYSTEM_PROMPT = `Eres Jarvis, un asistente personal inteligente que se comunica por WhatsApp.

Tu personalidad:
- Eres conciso y directo (es WhatsApp, no un email)
- Usas español naturalmente, puedes mezclar con inglés si el usuario lo hace
- Eres proactivo: si puedes buscar info en las notas del usuario, hazlo sin que te lo pidan
- Formateas para WhatsApp: usa *negritas*, _cursivas_, y listas simples

Capacidades:
- Acceso al vault de Obsidian del usuario (buscar, leer, crear, editar notas)
- Conocimiento general amplio
- Puedes ayudar con tareas, ideas, resúmenes, recordatorios

Reglas:
- Si el usuario pide buscar algo en sus notas, usa search_notes
- Si el usuario pide crear o guardar una nota, usa create_note
- Si pide agregar algo a una nota existente, usa append_to_note
- Sé breve. Respuestas de máximo 2-3 párrafos cortos a menos que pidan más detalle
- Nunca inventes contenido de las notas del usuario. Si no encuentras algo, dilo.`;

/**
 * Process a user message through the Claude agent with tool use
 */
export async function processMessage(
  phoneNumber: string,
  userMessage: string
): Promise<string> {
  // Add user message to history
  addMessage(phoneNumber, "user", userMessage);

  // Build messages array from history
  const history = getHistory(phoneNumber);
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Agent loop: keep running until we get a final text response
    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Handle tool use loop
    while (response.stop_reason === "tool_use") {
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      // Execute all tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type === "tool_use") {
          console.log(`🔧 Tool call: ${block.name}`, block.input);
          const result = await executeTool(
            block.name,
            block.input as Record<string, any>
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });

      // Continue the conversation
      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (b) => b.type === "text"
    );
    const reply = textBlocks.map((b) => (b as any).text).join("\n") || "🤔";

    // Save assistant response to history
    addMessage(phoneNumber, "assistant", reply);

    return reply;
  } catch (error: any) {
    console.error("Agent error:", error);
    return `⚠️ Error procesando tu mensaje: ${error.message}`;
  }
}
