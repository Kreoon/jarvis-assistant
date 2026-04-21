import { registerTool } from "../../core/tool-registry.js";
import { haikuComplete } from "../../connectors/anthropic.js";
import { config } from "../../config/index.js";

// --- get_current_datetime ---
registerTool(
  {
    name: "get_current_datetime",
    description:
      "Get the current date and time. Use when the user asks what day or time it is.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  async () => {
    return new Date().toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "full",
      timeStyle: "medium",
    });
  }
);

// --- translate ---
registerTool(
  {
    name: "translate",
    description:
      "Translate text between languages. Use when the user asks to translate something.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "The text to translate",
        },
        to: {
          type: "string",
          description:
            "Target language (e.g., 'english', 'spanish', 'french')",
        },
        from: {
          type: "string",
          description: "Source language (auto-detected if not specified)",
        },
      },
      required: ["text", "to"],
    },
  },
  async (input) => {
    const fromLang = input.from ? ` from ${input.from}` : "";
    const result = await haikuComplete(
      `Translate the following text${fromLang} to ${input.to}. Return ONLY the translation, nothing else.\n\n${input.text}`
    );
    return result || "Translation failed.";
  }
);

// --- check_services ---
registerTool(
  {
    name: "check_services",
    description:
      "Check if configured services/websites are online. Use when the user asks about service status, uptime, or if something is working.",
    input_schema: {
      type: "object" as const,
      properties: {
        urls: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional specific URLs to check. If not provided, checks default configured services.",
        },
      },
      required: [],
    },
  },
  async (input) => {
    const urls = input.urls?.length > 0 ? input.urls : config.services.urls;

    const results = await Promise.allSettled(
      urls.map(async (url: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const start = Date.now();
          const res = await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
          });
          const latency = Date.now() - start;
          return { url, status: res.status, latency, ok: res.ok };
        } finally {
          clearTimeout(timeout);
        }
      })
    );

    const lines = results.map((r, i) => {
      if (r.status === "fulfilled") {
        const { url, status, latency, ok } = r.value;
        const icon = ok ? "OK" : "WARN";
        return `[${icon}] **${url}** - ${status} (${latency}ms)`;
      } else {
        return `[DOWN] **${urls[i]}** - (${r.reason?.message || "timeout"})`;
      }
    });

    return lines.join("\n");
  }
);
