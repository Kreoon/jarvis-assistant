import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { registerTool } from "../../core/tool-registry.js";
import { search } from "../../connectors/perplexity.js";
import { haikuComplete } from "../../connectors/anthropic.js";

registerTool(
  { name: "web_search", description: "Search the web using Perplexity Sonar. Returns current results.", input_schema: { type: "object" as const, properties: { query: { type: "string" }, recency: { type: "string", enum: ["hour","day","week","month"] } }, required: ["query"] } },
  async (input) => {
    try {
      const r = await search(input.query, input.recency || "week");
      let result = r.answer;
      if (r.citations.length > 0) {
        result += "\n\n*Fuentes:*\n" + r.citations.map((c, i) => (i + 1) + ". " + c).join("\n");
      }
      return result;
    } catch (e: any) { return "Search error: " + e.message; }
  }
);

registerTool(
  { name: "web_read", description: "Read and extract clean content from a URL.", input_schema: { type: "object" as const, properties: { url: { type: "string" } }, required: ["url"] } },
  async (input) => {
    try {
      const res = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; JarvisBot/1.0)" } });
      if (!res.ok) return "Failed: " + res.status;
      const html = await res.text();
      const { document } = parseHTML(html);
      const article = new Readability(document as any).parse();
      if (!article) return "Could not extract content.";
      const content = article.textContent.replace(/\s+/g, " ").trim();
      return "**" + article.title + "**\n\n" + (content.length > 3000 ? content.substring(0, 3000) + "..." : content);
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  { name: "summarize_url", description: "Read a URL and generate a summary.", input_schema: { type: "object" as const, properties: { url: { type: "string" }, focus: { type: "string" } }, required: ["url"] } },
  async (input) => {
    try {
      const res = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; JarvisBot/1.0)" } });
      if (!res.ok) return "Failed: " + res.status;
      const html = await res.text();
      const { document } = parseHTML(html);
      const article = new Readability(document as any).parse();
      if (!article) return "Could not extract content.";
      const content = article.textContent.replace(/\s+/g, " ").trim();
      const truncated = content.length > 6000 ? content.substring(0, 6000) + "..." : content;
      const focusLine = input.focus ? "Focus: " + input.focus + "\n" : "";
      const summary = await haikuComplete("Summarize in Spanish. 3-5 bullets. " + focusLine + "\n\nTitle: " + article.title + "\n\n" + truncated);
      return "*" + article.title + "*\n\n" + summary;
    } catch (e: any) { return "Error: " + e.message; }
  }
);
