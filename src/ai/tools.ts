import Anthropic from "@anthropic-ai/sdk";
import * as vault from "../obsidian/vault.js";

/**
 * Tool definitions for the Claude agent
 */
export const tools: Anthropic.Tool[] = [
  {
    name: "search_notes",
    description:
      "Search through the user's Obsidian vault for notes containing a query. Use this when the user asks about their notes, knowledge, or wants to find something they wrote.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to find in notes",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "read_note",
    description:
      "Read the full content of a specific note from the Obsidian vault. Use after search_notes to read a specific result, or when the user references a specific note.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "The path to the note file (e.g., 'Projects/my-project.md')",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "create_note",
    description:
      "Create a new note or overwrite an existing one in the Obsidian vault. Use when the user asks to save, write, or create a note.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path for the note (e.g., 'Ideas/new-idea.md')",
        },
        content: {
          type: "string",
          description: "The markdown content for the note",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for the note frontmatter",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "append_to_note",
    description:
      "Append text to an existing note. Useful for adding to daily notes, logs, or task lists.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the note to append to",
        },
        text: {
          type: "string",
          description: "Text to append to the note",
        },
      },
      required: ["path", "text"],
    },
  },
  {
    name: "list_notes",
    description:
      "List all notes in a folder of the Obsidian vault. Use to browse the vault structure.",
    input_schema: {
      type: "object" as const,
      properties: {
        folder: {
          type: "string",
          description: "Folder path to list (empty string for root)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_daily_note",
    description:
      "Get today's daily note from Obsidian. Use when the user asks about today's notes, tasks, or agenda.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_current_datetime",
    description: "Get the current date and time. Use when the user asks what day or time it is.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

/**
 * Execute a tool call and return the result
 */
export async function executeTool(
  name: string,
  input: Record<string, any>
): Promise<string> {
  try {
    switch (name) {
      case "search_notes": {
        const results = await vault.searchNotes(input.query);
        if (results.length === 0) return "No notes found matching that query.";
        return results
          .map((r) => `📄 **${r.path}**\n${r.excerpt}`)
          .join("\n\n");
      }

      case "read_note": {
        const note = await vault.readNote(input.path);
        if (!note) return `Note not found: ${input.path}`;
        return note.content;
      }

      case "create_note": {
        const frontmatter: Record<string, any> = {
          created: new Date().toISOString(),
        };
        if (input.tags) frontmatter.tags = input.tags;

        await vault.writeNote(input.path, input.content, frontmatter);
        return `Note created: ${input.path}`;
      }

      case "append_to_note": {
        await vault.appendToNote(input.path, input.text);
        return `Text appended to: ${input.path}`;
      }

      case "list_notes": {
        const notes = await vault.listNotes(input.folder || "");
        if (notes.length === 0) return "No notes found in this folder.";
        return notes.map((n) => `- ${n}`).join("\n");
      }

      case "get_daily_note": {
        const content = await vault.getDailyNote();
        if (!content) return "No daily note found for today.";
        return content;
      }

      case "get_current_datetime": {
        return new Date().toLocaleString("es-CO", {
          timeZone: "America/Bogota",
          dateStyle: "full",
          timeStyle: "medium",
        });
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error: any) {
    return `Error executing ${name}: ${error.message}`;
  }
}
