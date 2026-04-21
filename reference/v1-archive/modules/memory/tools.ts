import { registerTool } from "../../core/tool-registry.js";
import { remember, searchMemories, forgetMemory } from "./store.js";

// --- save_memory ---
registerTool(
  {
    name: "save_memory",
    description:
      "Save an important fact about the user to persistent memory. Use this PROACTIVELY whenever the user shares personal information, preferences, names of people, dates, or anything you should remember for future conversations.",
    input_schema: {
      type: "object" as const,
      properties: {
        fact: {
          type: "string",
          description:
            "The fact to remember (e.g., 'La esposa de Alexander se llama Diana Milena, cumple 11 de diciembre')",
        },
        category: {
          type: "string",
          enum: [
            "familia",
            "personal",
            "negocio",
            "preferencias",
            "contactos",
            "fechas",
            "salud",
            "finanzas",
            "metas",
            "otro",
          ],
          description: "Category for the memory",
        },
      },
      required: ["fact", "category"],
    },
  },
  async (input) => {
    await remember(input.fact, input.category);
    return `Memorizado: ${input.fact}`;
  }
);

// --- recall_memory ---
registerTool(
  {
    name: "recall_memory",
    description:
      "Search your persistent memory for facts about the user. Use when the user asks 'do you remember...?', references something from a past conversation, or when you need context about them.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "What to search for in memory",
        },
      },
      required: ["query"],
    },
  },
  async (input) => {
    const results = await searchMemories(input.query);
    if (results.length === 0) {
      return "No encontre nada sobre eso en mi memoria.";
    }
    return results
      .map((r) => `[${r.category}] ${r.fact} (id: ${r.id})`)
      .join("\n");
  }
);

// --- forget_memory ---
registerTool(
  {
    name: "forget_memory",
    description:
      "Delete a specific memory. Use when the user asks you to forget something or correct a memory.",
    input_schema: {
      type: "object" as const,
      properties: {
        memory_id: {
          type: "string",
          description: "The memory ID to delete",
        },
      },
      required: ["memory_id"],
    },
  },
  async (input) => {
    const deleted = await forgetMemory(input.memory_id);
    return deleted ? "Olvidado." : "No encontre esa memoria.";
  }
);
