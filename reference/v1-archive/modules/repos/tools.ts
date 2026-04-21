import { registerTool } from "../../core/tool-registry.js";
import * as gh from "../../connectors/github.js";
import { haikuComplete } from "../../connectors/anthropic.js";

registerTool(
  { name: "get_repo_status", description: "Get GitHub repo status.", input_schema: { type: "object" as const, properties: { repo: { type: "string", enum: ["kreoon","jarvis","metrik","obsidian"] } }, required: ["repo"] } },
  async (input) => {
    try {
      const [repo, commits, prs, issues] = await Promise.all([gh.getRepoInfo(input.repo), gh.getCommits(input.repo, 3), gh.getOpenPRs(input.repo), gh.getOpenIssues(input.repo)]);
      return `📦 **${(repo as any).full_name}**\n📝 Last commits:\n${(commits as any[]).map((c: any) => `- \`${c.sha.slice(0,7)}\` ${c.commit.message.split("\n")[0]}`).join("\n")}\n🔀 Open PRs: ${(prs as any[]).length}\n🐛 Open Issues: ${(issues as any[]).filter((i: any) => !i.pull_request).length}`;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "create_github_issue", description: "Create GitHub issue.", input_schema: { type: "object" as const, properties: { repo: { type: "string", enum: ["kreoon","jarvis","metrik"] }, title: { type: "string" }, body: { type: "string" }, labels: { type: "array", items: { type: "string" } } }, required: ["repo","title","body"] } },
  async (input) => {
    try { const issue = await gh.createIssue(input.repo, input.title, input.body, input.labels || []) as any; return `✅ Issue #${issue.number} — ${issue.html_url}`; }
    catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "summarize_recent_changes", description: "Summarize recent repo changes.", input_schema: { type: "object" as const, properties: { repo: { type: "string", enum: ["kreoon","jarvis","metrik"] }, days: { type: "number" } }, required: ["repo"] } },
  async (input) => {
    try {
      const since = new Date(Date.now() - (input.days||7)*86400000).toISOString();
      const commits = await gh.getCommitsSince(input.repo, since) as any[];
      if (commits.length === 0) return "No commits in this period.";
      const list = commits.map((c: any) => `- ${c.commit.message.split("\n")[0]}`).join("\n");
      const summary = await haikuComplete(`Resume estos commits del repo "${input.repo}" en español. 3-5 bullets:\n\n${list}`);
      return `📊 **${input.repo}** (${commits.length} commits, ${input.days||7}d)\n\n${summary}`;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);
