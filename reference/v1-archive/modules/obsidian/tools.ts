import { readFile } from "fs/promises";
import { join } from "path";
import Fuse from "fuse.js";
import { registerTool } from "../../core/tool-registry.js";
import { config } from "../../config/index.js";
import * as vault from "./vault.js";
import { normalize } from "../utilities/normalize.js";

interface SearchItem {
  path: string;
  filename: string;
  content: string;
  normalizedContent: string;
  normalizedFilename: string;
}

// --- search_notes ---
registerTool(
  {
    name: "search_notes",
    description:
      "Search through the user's Obsidian vault for notes containing a query. Uses fuzzy matching and accent-insensitive search. Use this when the user asks about their notes, knowledge, or wants to find something they wrote.",
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
  async (input) => {
    const vaultPath = config.obsidian.vaultPath;
    const { glob } = await import("glob");
    const files = await glob("**/*.md", { cwd: vaultPath });
    const queryNorm = normalize(input.query);

    // Build search items
    const items: SearchItem[] = [];
    for (const file of files) {
      if (file.startsWith(".obsidian")) continue;
      const content = await readFile(join(vaultPath, file), "utf-8");
      const filename = file.split("/").pop() || file;
      items.push({
        path: file,
        filename,
        content,
        normalizedContent: normalize(content),
        normalizedFilename: normalize(filename),
      });
    }

    // Phase 1: exact normalized match (filename + content)
    const exactResults: { path: string; excerpt: string }[] = [];
    for (const item of items) {
      if (
        item.normalizedFilename.includes(queryNorm) ||
        item.normalizedContent.includes(queryNorm)
      ) {
        const idx = item.normalizedContent.indexOf(queryNorm);
        let excerpt: string;
        if (idx >= 0) {
          const start = Math.max(0, idx - 100);
          const end = Math.min(
            item.content.length,
            idx + input.query.length + 100
          );
          excerpt = `...${item.content.substring(start, end).trim()}...`;
        } else {
          excerpt = item.content.substring(0, 200).trim() + "...";
        }
        exactResults.push({ path: item.path, excerpt });
      }
      if (exactResults.length >= 10) break;
    }

    if (exactResults.length > 0) {
      return exactResults
        .map((r) => `**${r.path}**\n${r.excerpt}`)
        .join("\n\n");
    }

    // Phase 2: fuzzy search with Fuse.js
    const fuse = new Fuse(items, {
      keys: [
        { name: "normalizedFilename", weight: 2 },
        { name: "normalizedContent", weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
    });

    const fuseResults = fuse.search(queryNorm, { limit: 10 });

    if (fuseResults.length === 0) {
      return "No notes found matching that query.";
    }

    return fuseResults
      .map((r) => {
        const item = r.item;
        const excerpt = item.content.substring(0, 200).trim() + "...";
        return `**${item.path}** (score: ${(1 - (r.score || 0)).toFixed(2)})\n${excerpt}`;
      })
      .join("\n\n");
  }
);

// --- read_note ---
registerTool(
  {
    name: "read_note",
    description:
      "Read the full content of a specific note from the Obsidian vault. Use after search_notes to read a specific result, or when the user references a specific note.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "The path to the note file (e.g., 'Projects/my-project.md')",
        },
      },
      required: ["path"],
    },
  },
  async (input) => {
    const note = await vault.readNote(input.path);
    if (!note) return `Note not found: ${input.path}`;
    return note.content;
  }
);

// --- create_note ---
registerTool(
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
  async (input) => {
    const frontmatter: Record<string, any> = {
      created: new Date().toISOString(),
    };
    if (input.tags) frontmatter.tags = input.tags;
    await vault.writeNote(input.path, input.content, frontmatter);
    return `Note created: ${input.path}`;
  }
);

// --- append_to_note ---
registerTool(
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
  async (input) => {
    await vault.appendToNote(input.path, input.text);
    return `Text appended to: ${input.path}`;
  }
);

// --- list_notes ---
registerTool(
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
  async (input) => {
    const notes = await vault.listNotes(input.folder || "");
    if (notes.length === 0) return "No notes found in this folder.";
    return notes.map((n) => `- ${n}`).join("\n");
  }
);

// --- get_daily_note ---
registerTool(
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
  async () => {
    const content = await vault.getDailyNote();
    if (!content) return "No daily note found for today.";
    return content;
  }
);

// --- quick_capture ---
registerTool(
  {
    name: "quick_capture",
    description:
      "Quickly capture an idea, thought, or note into the Obsidian Inbox. Use when the user says 'anota', 'captura', 'guarda esto', or wants to save a quick thought without specifying a path.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Short title for the capture",
        },
        content: {
          type: "string",
          description: "The content to capture",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags",
        },
      },
      required: ["title", "content"],
    },
  },
  async (input) => {
    const today = new Date().toISOString().split("T")[0];
    const slug = input.title
      .toLowerCase()
      .replace(/[^a-z0-9\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);
    const path = `00 - Inbox/${today}-${slug}.md`;

    const frontmatter: Record<string, any> = {
      created: new Date().toISOString(),
      source: "jarvis-whatsapp",
    };
    if (input.tags) frontmatter.tags = input.tags;

    await vault.writeNote(path, input.content, frontmatter);
    return `Captured in: ${path}`;
  }
);
