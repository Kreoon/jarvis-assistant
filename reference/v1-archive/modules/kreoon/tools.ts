import { registerTool } from "../../core/tool-registry.js";
import * as kreoon from "../../connectors/kreoon.js";

registerTool(
  { name: "kreoon_list_orgs", description: "List all KREOON organizations.", input_schema: { type: "object" as const, properties: {}, required: [] } },
  async () => {
    try {
      const orgs = await kreoon.listOrganizations();
      return orgs.map((o: any) => `**${o.name}** (${o.slug}) ID: ${o.id}`).join("\n");
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_org_dashboard", description: "Get KREOON org dashboard.", input_schema: { type: "object" as const, properties: { org_id: { type: "string" } }, required: ["org_id"] } },
  async (input) => {
    try {
      const d = await kreoon.getOrgDashboard(input.org_id);
      return `**${d.name}**\n${(d.members||[]).length} miembros | ${(d.clients||[]).length} clientes | ${(d.content||[]).length} contenidos`;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_list_content", description: "List content in a KREOON org.", input_schema: { type: "object" as const, properties: { org_id: { type: "string" }, status: { type: "string" } }, required: ["org_id"] } },
  async (input) => {
    try {
      const items = await kreoon.listContent(input.org_id, input.status);
      if (!items.length) return "No content found.";
      return items.map((c: any) => `**${c.title}** [${c.status}]${c.client ? " - " + c.client.name : ""}`).join("\n");
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_create_content", description: "Create content in KREOON.", input_schema: { type: "object" as const, properties: { title: { type: "string" }, description: { type: "string" }, org_id: { type: "string" }, client_id: { type: "string" }, creator_id: { type: "string" } }, required: ["title","org_id"] } },
  async (input) => {
    try {
      const c = await kreoon.createContent({ title: input.title, description: input.description, organization_id: input.org_id, client_id: input.client_id, creator_id: input.creator_id });
      return `Created: **${c.title}** ID: ${c.id}`;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_update_status", description: "Update content status.", input_schema: { type: "object" as const, properties: { content_id: { type: "string" }, status: { type: "string" } }, required: ["content_id","status"] } },
  async (input) => {
    try { const c = await kreoon.updateContentStatus(input.content_id, input.status); return `Updated: **${c.title}** -> ${input.status}`; }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_list_clients", description: "List clients in KREOON org.", input_schema: { type: "object" as const, properties: { org_id: { type: "string" } }, required: ["org_id"] } },
  async (input) => {
    try { const cl = await kreoon.listClients(input.org_id); return cl.map((c: any) => `**${c.name}**${c.contact_email ? " (" + c.contact_email + ")" : ""}`).join("\n"); }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_list_members", description: "List org members.", input_schema: { type: "object" as const, properties: { org_id: { type: "string" } }, required: ["org_id"] } },
  async (input) => {
    try { const m = await kreoon.listOrgMembers(input.org_id); return m.map((x: any) => `**${x.profiles?.full_name || "?"}** - ${x.role}`).join("\n"); }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_pending_payments", description: "List pending payments.", input_schema: { type: "object" as const, properties: {}, required: [] } },
  async () => {
    try { const p = await kreoon.listPendingPayments(); if (!p.length) return "No pending payments."; return p.map((x: any) => `$${x.amount} -> ${x.profiles?.full_name || "?"} (${x.content?.title || "?"})`).join("\n"); }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_search", description: "Search KREOON content.", input_schema: { type: "object" as const, properties: { query: { type: "string" } }, required: ["query"] } },
  async (input) => {
    try { const r = await kreoon.searchContent(input.query); if (!r.length) return "No results."; return r.map((c: any) => `**${c.title}** [${c.status}]`).join("\n"); }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_recent_activity", description: "Recent activity in KREOON.", input_schema: { type: "object" as const, properties: { limit: { type: "number" } }, required: [] } },
  async (input) => {
    try { const a = await kreoon.getRecentActivity(input.limit || 15); if (!a.length) return "No activity."; return a.map((x: any) => `${x.content?.title || "?"}: ${x.old_status||"?"} -> ${x.new_status}`).join("\n"); }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "kreoon_generate_script", description: "Generate AI script for KREOON product.", input_schema: { type: "object" as const, properties: { product_id: { type: "string" }, content_type: { type: "string" } }, required: ["product_id"] } },
  async (input) => {
    try { const r = await kreoon.generateScript(input.product_id, input.content_type || "reel"); return typeof r === "string" ? r : JSON.stringify(r, null, 2); }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);
