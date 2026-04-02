import { coreAgent } from '../agents/core/index.js';
import { memoryAgent } from '../agents/memory/index.js';
import { contentAgent } from '../agents/content/index.js';
import { opsAgent } from '../agents/ops/index.js';
import { analystAgent, isSocialMediaUrl, hasAnalystSession } from '../agents/analyst/index.js';
import { matchSkills } from './skill-loader.js';
import { agentLogger } from '../shared/logger.js';
import type { ProgressCallback } from './base-agent.js';
import type { AgentName, AgentRequest, AgentResponse } from '../shared/types.js';

// Lazy-loaded modules to avoid circular imports
let engineModule: typeof import('../agents/engine/index.js') | null = null;
let reportModule: typeof import('../connectors/report-generator.js') | null = null;
let brandResearcherModule: typeof import('../agents/brand-researcher/index.js') | null = null;

// Research trigger: /research email@domain.com
const RESEARCH_TRIGGER = /^\/research\s+(\S+@\S+\.\S+)/i;

// Diagnosis trigger: "diagnostico para @handle" or "analiza @handle" or "/diagnose @handle"
const DIAGNOSIS_TRIGGER = /(?:diagn[oó]stic[oa]|an[aá]li[sz][aei]s?|investiga|research).*?@(\w[\w._]{1,30}\w)/i;

// Engine trigger patterns — match loosely to avoid missing triggers
const ENGINE_TRIGGERS = [
  /genera[r]?\s+contenido/i,
  /\/engine/i,
  /daily\s+(report|briefing)/i,
  /genera[r]?\s+reporte/i,
  /motor\s+de\s+contenido/i,
  /content\s+engine/i,
  /genera[r]?\s*guion/i,
  /briefing\s+diario/i,
  /guiones/i,
  /busca.*correos.*noticias/i,
  /busca.*newsletters/i,
  /lee.*emails.*genera/i,
  /revisa.*correos/i,
  /genera.*video.*viral/i,
  /crea.*contenido/i,
  /dame.*guion/i,
];

const log = agentLogger('router');

// Agents that extend BaseAgent
const baseAgents = {
  core: coreAgent,
  memory: memoryAgent,
  content: contentAgent,
  ops: opsAgent,
} as const;

// URL regex to detect social media links in messages
const URL_REGEX = /https?:\/\/[^\s]+/gi;

// Role-based agent restrictions: roles not listed here have full access
const ROLE_ALLOWED_AGENTS: Partial<Record<string, string[]>> = {
  community: ['analyst'], // Diana: solo análisis de contenido
  readonly: [],           // Sin acceso a agentes
};

// Agents blocked per role (checked during routing)
const ROLE_BLOCKED_AGENTS: Partial<Record<string, string[]>> = {
  ops: ['memory'],  // Brian: todo excepto Obsidian/memoria
};

export async function routeMessage(req: AgentRequest, onProgress?: ProgressCallback): Promise<AgentResponse> {
  // === Role-based access control ===
  const allowedAgents = ROLE_ALLOWED_AGENTS[req.member.role];
  if (allowedAgents !== undefined && allowedAgents.length === 0) {
    return { text: 'Tu rol no tiene acceso a Jarvis en este momento.' };
  }

  // === Pre-routing: Detect social media URLs ===
  const messageText = req.message.text || '';
  log.info({ messageText: messageText?.slice(0, 200) }, 'Router checking message');

  const urls = messageText.match(URL_REGEX) || [];
  const socialUrl = urls.find(url => isSocialMediaUrl(url));

  // === Pre-routing: Check if user has pending analyst session (waiting for A/B response) ===
  if (hasAnalystSession(req.message.from)) {
    log.info({ from: req.message.from }, 'User has pending analyst session, routing response to analyst');
    const analystReq: AgentRequest = { ...req, agent: 'analyst' };
    const response = await analystAgent.handle(analystReq, onProgress);
    storeInteraction(req, response, 'analyst').catch(() => {});
    return response;
  }

  if (socialUrl) {
    log.info({ url: socialUrl }, 'Social media URL detected, routing to analyst');

    if (onProgress) {
      await onProgress('Vi el link, déjame revisarlo...').catch(() => {});
    }

    const analystReq: AgentRequest = {
      ...req,
      agent: 'analyst',
      intent: `URL detectada: ${socialUrl}`,
    };

    const response = await analystAgent.handle(analystReq, onProgress);
    storeInteraction(req, response, 'analyst').catch(() => {});
    return response;
  }

  // === Pre-routing: Check for /research command ===
  const researchMatch = messageText.match(RESEARCH_TRIGGER);
  if (researchMatch) {
    const email = researchMatch[1];
    log.info({ email }, '/research command detected');

    if (onProgress) {
      await onProgress('Dale, investigando esa marca...').catch(() => {});
    }

    try {
      if (!brandResearcherModule) {
        brandResearcherModule = await import('../agents/brand-researcher/index.js');
      }
      const reply = await brandResearcherModule.researchByEmail(email);
      return { text: reply };
    } catch (error: any) {
      log.error({ error: error.message }, '/research command failed');
      return { text: `Uy parce, no pude con esa investigación: ${error.message}` };
    }
  }

  // === Pre-routing: Check for brand diagnosis by @handle ===
  const diagnosisMatch = messageText.match(DIAGNOSIS_TRIGGER);
  if (diagnosisMatch && req.member.role === 'owner') {
    const handle = diagnosisMatch[1];
    log.info({ handle }, 'Brand diagnosis by @handle detected');

    if (onProgress) {
      await onProgress('Mirando esa marca, ya te cuento...').catch(() => {});
    }

    try {
      if (!brandResearcherModule) {
        brandResearcherModule = await import("../agents/brand-researcher/index.js");
      }
      const reply = await brandResearcherModule.researchByHandle(handle);
      return { text: reply };
    } catch (error: any) {
      log.error({ error: error.message }, 'Brand diagnosis by handle failed');
      return { text: `Uy, no pude hacer el diagnóstico: ${error.message}` };
    }
  }

  // === Role restriction: community users can only use analyst ===
  if (allowedAgents && !allowedAgents.includes('all')) {
    // If we got here, the message wasn't a social media URL or pending analyst session
    return {
      text: `Hola ${req.member.name} 👋 Por ahora tienes acceso al análisis de contenido. Envíame un link de Instagram, TikTok, YouTube o cualquier red social y te hago un análisis completo.`,
    };
  }

  // === Pre-routing: Check for engine trigger ===
  if (ENGINE_TRIGGERS.some(re => re.test(messageText))) {
    log.info('Engine trigger detected, running daily content engine');

    if (onProgress) {
      await onProgress('Generando el contenido del día, dame un momento...').catch(() => {});
    }

    try {
      if (!engineModule) {
        engineModule = await import('../agents/engine/index.js');
      }
      if (!reportModule) {
        reportModule = await import('../connectors/report-generator.js');
      }

      const report = await engineModule.runDailyContentEngine((msg) => {
        onProgress?.(msg);
      }, req.message.from);

      // Post to web app and get URL
      const webUrl = await reportModule.postDailyReport(report).catch(() => null);

      // Save to Obsidian
      try {
        const date = report.date;
        const md = reportModule.formatReportMarkdown(report);
        const axios = (await import('axios')).default;
        const { config: cfg } = await import('../shared/config.js');
        const couchUrl = cfg.couchdb.url || 'http://couchdb:5984';
        const obsidianDb = process.env.OBSIDIAN_DB || 'obsidian-vault';
        const docId = `jarvis_daily-engine_${date}.md`.replace(/\//g, '_');
        const auth = cfg.couchdb.user
          ? { Authorization: `Basic ${Buffer.from(`${cfg.couchdb.user}:${cfg.couchdb.pass}`).toString('base64')}` }
          : {};

        let rev: string | undefined;
        try {
          const existing = await axios.get(`${couchUrl}/${obsidianDb}/${encodeURIComponent(docId)}`, { headers: { ...auth } });
          rev = existing.data._rev;
        } catch { /* doc doesn't exist */ }

        const doc: Record<string, unknown> = {
          _id: docId,
          path: `jarvis/daily-engine/${date}.md`,
          content: md,
          updatedAt: new Date().toISOString(),
        };
        if (rev) doc._rev = rev;

        await axios.put(`${couchUrl}/${obsidianDb}/${encodeURIComponent(docId)}`, doc, {
          headers: { 'Content-Type': 'application/json', ...auth },
        });
      } catch { /* Obsidian save failed, non-critical */ }

      // Return WhatsApp summary with web link
      const summary = reportModule.formatWhatsAppSummary(report, webUrl);
      return { text: summary };
    } catch (error: any) {
      log.error({ error: error.message }, 'Engine execution failed');
      return { text: `Se me complicó generando el contenido: ${error.message}` };
    }
  }

  // === Pre-routing: Log matched skills for debugging ===
  const matched = matchSkills(messageText);
  if (matched.length) {
    log.info(
      { skills: matched.map(s => s.name) },
      'Skills detected — will be injected into specialist agent',
    );
  }

  // === Standard routing via Core Agent ===
  const coreResponse = await coreAgent.handle(req, onProgress);

  // Parse routing from response
  const routeMatch = coreResponse.text.match(/\[ROUTE:(\w+)\]/);
  if (routeMatch) {
    const targetAgent = routeMatch[1] as AgentName;

    // Handle openclaw routing — delegate to content agent which has openclaw as universal tool
    if (targetAgent === 'openclaw') {
      log.info({ from: 'core', to: 'content (via openclaw)' }, 'Routing openclaw request to content agent');
      if (onProgress) {
        await onProgress('Dame un momento, estoy en eso...').catch(() => {});
      }
      const contentReq: AgentRequest = {
        ...req,
        agent: 'content',
        intent: coreResponse.text.replace(/\[ROUTE:\w+\]/, '').trim(),
      };
      const response = await contentAgent.handle(contentReq, onProgress);
      storeInteraction(req, response, 'content').catch(() => {});
      return response;
    }

    // Handle analyst routing (analyst is not in baseAgents but has its own handle)
    if (targetAgent === 'analyst') {
      log.info({ from: 'core', to: 'analyst' }, 'Routing to analyst agent');
      if (onProgress) {
        await onProgress('Analizando, ya te cuento...').catch(() => {});
      }
      const analystReq: AgentRequest = {
        ...req,
        agent: 'analyst',
        intent: coreResponse.text.replace(/\[ROUTE:\w+\]/, '').trim(),
      };
      const response = await analystAgent.handle(analystReq, onProgress);
      storeInteraction(req, response, 'analyst').catch(() => {});
      return response;
    }

    if (targetAgent in baseAgents && targetAgent !== 'core') {
      // Check if this agent is blocked for the user's role
      const blockedAgents = ROLE_BLOCKED_AGENTS[req.member.role];
      if (blockedAgents?.includes(targetAgent)) {
        log.info({ from: req.member.name, blocked: targetAgent, role: req.member.role }, 'Agent blocked for role');
        return { text: `Lo siento ${req.member.name}, no tienes acceso a esa funcionalidad. Si necesitas algo de ahí, pídele a Alexander.` };
      }

      log.info({ from: 'core', to: targetAgent }, 'Routing to specialist agent');

      if (onProgress) {
        const names: Record<string, string> = {
          memory: 'Déjame revisar eso...',
          content: 'Ya me pongo en eso...',
          ops: 'En eso estoy...',
          analyst: 'Analizando, ya te cuento...',
        };
        await onProgress(names[targetAgent] || 'Dame un seg...').catch(() => {});
      }

      const specialistReq: AgentRequest = {
        ...req,
        agent: targetAgent,
        intent: coreResponse.text.replace(/\[ROUTE:\w+\]/, '').trim(),
      };

      const agent = baseAgents[targetAgent as keyof typeof baseAgents];
      const specialistResponse = await agent.handle(specialistReq, onProgress);
      storeInteraction(req, specialistResponse, targetAgent).catch(() => {});
      return specialistResponse;
    }
  }

  // Core handled it directly
  storeInteraction(req, coreResponse, 'core').catch(() => {});
  return coreResponse;
}

async function storeInteraction(
  req: AgentRequest,
  res: AgentResponse,
  handledBy: AgentName
): Promise<void> {
  try {
    await memoryAgent.handle({
      agent: 'memory',
      message: {
        ...req.message,
        text: `[AUTO-LOG] ${req.member.name}: "${req.message.text?.slice(0, 200)}" → handled by ${handledBy}`,
        type: 'text',
      },
      member: req.member,
      intent: 'store_interaction',
    });
  } catch {
    // Non-critical, ignore
  }
}
