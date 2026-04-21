import { registerTool } from "../../core/tool-registry.js";
import * as metaAds from "../../connectors/meta-ads.js";

registerTool(
  { name: "meta_ads_list_accounts", description: "List all available Meta Ads accounts. ALWAYS call this FIRST before any other Meta Ads tool.", input_schema: { type: "object" as const, properties: {}, required: [] } },
  async () => {
    try {
      const accounts = await metaAds.listAccounts();
      if (accounts.length === 0) return "No ad accounts found.";
      return "📋 *Cuentas publicitarias:*\n\n" + accounts.map((a: any, i: number) =>
        `${i+1}. **${a.name || a.account_id}** — ID: \`${a.account_id || a.id}\` ${a.account_status === 1 ? "✅" : "⏸"}`
      ).join("\n") + "\n\n_¿Cuál cuenta quieres consultar?_";
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "meta_ads_query", description: "Send a natural language Meta Ads query through n8n workflow. Use AFTER user selects account.", input_schema: { type: "object" as const, properties: { message: { type: "string", description: "User question about ads" }, phone: { type: "string", description: "User phone" }, account_id: { type: "string", description: "Selected account ID" } }, required: ["message", "phone", "account_id"] } },
  async (input) => {
    try { return await metaAds.queryWebhook(input.message, input.phone, input.account_id); }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "meta_ads_campaigns", description: "Get campaigns list for a Meta Ads account.", input_schema: { type: "object" as const, properties: { account_id: { type: "string" } }, required: ["account_id"] } },
  async (input) => {
    try {
      const campaigns = await metaAds.getCampaigns(input.account_id);
      const active = campaigns.filter((c: any) => c.status === "ACTIVE");
      const paused = campaigns.filter((c: any) => c.status === "PAUSED");
      let r = `📊 ${active.length} activas, ${paused.length} pausadas\n\n▶️ *Activas:*\n`;
      r += active.map((c: any) => `• **${c.name}**\n  ${c.objective?.replace("OUTCOME_","")}${c.daily_budget ? ` | $${(c.daily_budget/100).toFixed(0)}/día` : ""}`).join("\n\n");
      return r;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "meta_ads_insights", description: "Get metrics for a date range.", input_schema: { type: "object" as const, properties: { account_id: { type: "string" }, since: { type: "string" }, until: { type: "string" }, level: { type: "string", enum: ["campaign","adset","ad"] } }, required: ["account_id","since","until"] } },
  async (input) => {
    try {
      const insights = await metaAds.getInsights(input.since, input.until, input.level || "campaign", input.account_id);
      if (insights.length === 0) return "No data for this period.";
      let total = 0;
      const lines = insights.map((i: any) => { const s = parseFloat(i.spend||"0"); total += s; return `📊 **${i.campaign_name||i.adset_name||"—"}**\n   💰$${s.toFixed(2)} | CPM $${parseFloat(i.cpm||"0").toFixed(2)} | CTR ${parseFloat(i.ctr||"0").toFixed(2)}%`; });
      return `📈 ${input.since} → ${input.until}\n💰 Total: $${total.toFixed(2)}\n\n${lines.join("\n\n")}`;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "meta_ads_toggle_campaign", description: "Activate or pause a campaign.", input_schema: { type: "object" as const, properties: { campaign_id: { type: "string" }, status: { type: "string", enum: ["ACTIVE","PAUSED"] } }, required: ["campaign_id","status"] } },
  async (input) => {
    try { await metaAds.toggleCampaign(input.campaign_id, input.status); return `${input.status === "ACTIVE" ? "▶️" : "⏸"} Campaign → **${input.status}**`; }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "meta_ads_creatives", description: "Get ad creatives and preview links.", input_schema: { type: "object" as const, properties: { account_id: { type: "string" }, adset_id: { type: "string" } }, required: ["account_id"] } },
  async (input) => {
    try {
      const ads = await metaAds.getAds(input.account_id, input.adset_id);
      if (ads.length === 0) return "No ads found.";
      return ads.slice(0,10).map((a: any) => `🎨 **${a.name}** — ${a.status}${a.preview_shareable_link ? `\n🔗 ${a.preview_shareable_link}` : ""}`).join("\n\n");
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);
