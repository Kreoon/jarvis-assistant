import { BaseAgent } from '../../core/base-agent.js';
import { callLLM } from '../../core/llm.js';
import { searchWeb } from '../../shared/perplexity.js';
import { agentLogger } from '../../shared/logger.js';
import { sendText } from '../../connectors/whatsapp.js';
import { config } from '../../shared/config.js';
import fs from 'fs';
import type { AgentRequest, AgentResponse } from '../../shared/types.js';

const log = agentLogger('lead-hunter');
const LEADS_FILE = '/app/data/leads.json';
const OWNER_PHONE = config.dailyEngine.ownerPhone;

// Lead types by business
interface Lead {
  id: string;
  business: 'ugc_colombia' | 'reyes_contenido' | 'prolab' | 'infiny_latam' | 'kreoon';
  name: string;
  handle: string;
  platform: string;
  email?: string;
  website?: string;
  score: number;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  notes: string;
  outreachDraft?: string;
  createdAt: string;
  lastContact?: string;
}

function loadLeads(): Lead[] {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function saveLeads(leads: Lead[]): void {
  fs.mkdirSync('/app/data', { recursive: true });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

function generateId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const SYSTEM_PROMPT = `Eres el Lead Hunter de Jarvis — buscas clientes y oportunidades para el ecosistema de Alexander Cast.

## Negocios y su ICP (Ideal Customer Profile)

### UGC Colombia (@agenciaugccolombia)
- TARGET: Marcas/empresas en LATAM que necesitan contenido UGC
- SEÑALES: Publican contenido de baja calidad, no usan creators, hacen ads con stock footage
- BUSCAR: Marcas de beauty, fashion, food, tech, fitness que estén activas en IG/TikTok

### Reyes del Contenido (@reyesdelcontenidoo)
- TARGET: Creators emergentes (1K-50K followers) en LATAM
- SEÑALES: Publican contenido regularmente, buscan crecer, quieren monetizar
- BUSCAR: Hashtags como #creadordecontenido, #ugccreator, #creadoreslatam

### Prolab (@saludprolab)
- TARGET: Emprendedores que quieren hacer dropshipping de productos de salud/bienestar
- SEÑALES: Hablan de emprendimiento, ecommerce, ingresos pasivos
- BUSCAR: Perfiles de emprendedores, grupos de Facebook, hashtags de negocio online

### Infiny Latam (@infinylatam)
- TARGET: Empresas que necesitan marketing digital y growth
- SEÑALES: Baja presencia digital, ads mal hechos, no tienen estrategia clara

### Kreoon (@somoskreoon)
- TARGET: Empresas que necesitan software/tech solutions
- SEÑALES: Procesos manuales, sin app/plataforma, necesitan automatización

## Cómo calificas leads (score 1-10)
- 1-3: Frío — solo matching superficial
- 4-6: Tibio — señales claras de necesidad
- 7-9: Caliente — necesidad urgente + presupuesto probable
- 10: Listo para cerrar — ya pidió info o mostró intención

## Output
Siempre incluye: nombre, @handle, plataforma, por qué es lead, score, y un draft de outreach.`;

class LeadHunterAgent extends BaseAgent {
  constructor() {
    super({
      name: 'lead-hunter',
      systemPrompt: SYSTEM_PROMPT,
      tools: [
        {
          name: 'search_leads',
          description: 'Busca leads para un negocio específico usando web search y análisis de perfiles.',
          parameters: {
            type: 'object',
            properties: {
              business: { type: 'string', description: 'Negocio: ugc_colombia, reyes_contenido, prolab, infiny_latam, kreoon' },
              query: { type: 'string', description: 'Query de búsqueda específico (opcional — se genera automáticamente si no se da)' },
              count: { type: 'number', description: 'Cantidad de leads a buscar. Default: 5' },
            },
            required: ['business'],
          },
        },
        {
          name: 'qualify_lead',
          description: 'Califica un lead existente con más información.',
          parameters: {
            type: 'object',
            properties: {
              handle: { type: 'string', description: '@handle del lead' },
              business: { type: 'string', description: 'Para qué negocio' },
              notes: { type: 'string', description: 'Información adicional del lead' },
            },
            required: ['handle', 'business'],
          },
        },
        {
          name: 'store_lead',
          description: 'Guarda un lead en la base de datos.',
          parameters: {
            type: 'object',
            properties: {
              business: { type: 'string' },
              name: { type: 'string' },
              handle: { type: 'string' },
              platform: { type: 'string' },
              score: { type: 'number' },
              notes: { type: 'string' },
              email: { type: 'string' },
              website: { type: 'string' },
              outreach_draft: { type: 'string' },
            },
            required: ['business', 'name', 'handle', 'platform', 'score', 'notes'],
          },
        },
        {
          name: 'get_pipeline',
          description: 'Obtiene el pipeline de leads por negocio o todos.',
          parameters: {
            type: 'object',
            properties: {
              business: { type: 'string', description: 'Negocio o "all"' },
              status: { type: 'string', description: 'Filtrar por status: new, contacted, qualified, converted, lost' },
            },
            required: [],
          },
        },
        {
          name: 'generate_outreach',
          description: 'Genera un mensaje de outreach personalizado para un lead.',
          parameters: {
            type: 'object',
            properties: {
              business: { type: 'string', description: 'Desde qué negocio se contacta' },
              lead_name: { type: 'string' },
              lead_handle: { type: 'string' },
              lead_context: { type: 'string', description: 'Contexto del lead (qué hace, qué necesita)' },
              channel: { type: 'string', description: 'Canal: dm_instagram, email, whatsapp' },
            },
            required: ['business', 'lead_name', 'lead_context', 'channel'],
          },
        },
        {
          name: 'update_lead_status',
          description: 'Actualiza el estado de un lead en el pipeline.',
          parameters: {
            type: 'object',
            properties: {
              lead_id: { type: 'string', description: 'ID del lead' },
              status: { type: 'string', description: 'Nuevo status: contacted, qualified, converted, lost' },
              notes: { type: 'string', description: 'Notas adicionales' },
            },
            required: ['lead_id', 'status'],
          },
        },
      ],
      toolHandlers: {
        search_leads: async (args) => {
          const business = args.business as string;
          const count = (args.count as number) || 5;
          let query = args.query as string;

          // Auto-generate search query based on business
          if (!query) {
            const queries: Record<string, string> = {
              ugc_colombia: 'marcas colombianas que necesitan contenido UGC Instagram 2026 agencias',
              reyes_contenido: 'creadores de contenido emergentes Colombia LATAM Instagram TikTok 2026',
              prolab: 'emprendedores dropshipping Colombia productos salud bienestar 2026',
              infiny_latam: 'empresas colombianas que necesitan marketing digital growth 2026',
              kreoon: 'empresas colombianas que necesitan desarrollo de software app plataforma 2026',
            };
            query = queries[business] || `leads ${business} Colombia 2026`;
          }

          try {
            const webResults = await searchWeb(query);

            // Use LLM to extract leads from search results
            const extractResponse = await callLLM(
              [
                {
                  role: 'system',
                  content: `Eres un experto en prospección de leads. De los resultados de búsqueda, extrae ${count} leads potenciales para ${business}.

Para cada lead, genera JSON:
[{
  "name": "Nombre de la marca/persona",
  "handle": "@instagram_handle (si lo encuentras)",
  "platform": "instagram|linkedin|web",
  "score": 5,
  "notes": "Por qué es un lead potencial",
  "website": "url si la encuentras"
}]

Solo JSON array. Si no encuentras leads concretos, genera leads probables basados en la industria.`,
                },
                { role: 'user', content: `Resultados de búsqueda:\n${webResults.result.slice(0, 3000)}` },
              ],
              { maxTokens: 2000 },
            );

            let leads: any[] = [];
            try {
              let jsonStr = extractResponse.text.trim();
              const match = jsonStr.match(/\[[\s\S]*\]/);
              if (match) jsonStr = match[0];
              leads = JSON.parse(jsonStr);
            } catch {
              leads = [{ name: 'No se pudieron extraer leads', handle: '-', platform: '-', score: 0, notes: extractResponse.text.slice(0, 200) }];
            }

            // Auto-store leads
            const stored = loadLeads();
            for (const lead of leads) {
              if (lead.score > 0) {
                stored.push({
                  id: generateId(),
                  business: business as Lead['business'],
                  name: lead.name,
                  handle: lead.handle || '-',
                  platform: lead.platform || 'web',
                  email: lead.email,
                  website: lead.website,
                  score: lead.score,
                  status: 'new',
                  notes: lead.notes,
                  createdAt: new Date().toISOString(),
                });
              }
            }
            saveLeads(stored);

            return { found: leads.length, leads, storedTotal: stored.length };
          } catch (error: any) {
            return { error: error.message };
          }
        },

        qualify_lead: async (args) => {
          const handle = args.handle as string;
          const business = args.business as string;

          // Search for more info about this lead
          try {
            const webResults = await searchWeb(`${handle} Instagram ${business === 'prolab' ? 'emprendedor' : 'marca'} Colombia`);

            const qualifyResponse = await callLLM(
              [
                {
                  role: 'system',
                  content: `Califica este lead para ${business}. Score 1-10 con justificación. ¿Tiene presupuesto probable? ¿Necesita el servicio? ¿Es accesible?`,
                },
                { role: 'user', content: `Lead: ${handle}\nInfo encontrada:\n${webResults.result.slice(0, 2000)}` },
              ],
              { maxTokens: 500 },
            );

            return { handle, business, qualification: qualifyResponse.text };
          } catch (error: any) {
            return { error: error.message };
          }
        },

        store_lead: async (args) => {
          const leads = loadLeads();
          const lead: Lead = {
            id: generateId(),
            business: args.business as Lead['business'],
            name: args.name as string,
            handle: args.handle as string,
            platform: args.platform as string,
            email: args.email as string,
            website: args.website as string,
            score: args.score as number,
            status: 'new',
            notes: args.notes as string,
            outreachDraft: args.outreach_draft as string,
            createdAt: new Date().toISOString(),
          };
          leads.push(lead);
          saveLeads(leads);
          return { success: true, leadId: lead.id, totalLeads: leads.length };
        },

        get_pipeline: async (args) => {
          const leads = loadLeads();
          const business = (args.business as string) || 'all';
          const status = args.status as string;

          let filtered = leads;
          if (business !== 'all') filtered = filtered.filter(l => l.business === business);
          if (status) filtered = filtered.filter(l => l.status === status);

          const summary: Record<string, number> = {};
          for (const l of filtered) {
            summary[l.status] = (summary[l.status] || 0) + 1;
          }

          return {
            total: filtered.length,
            byStatus: summary,
            leads: filtered.slice(-20), // Last 20
          };
        },

        generate_outreach: async (args) => {
          const business = args.business as string;
          const channel = args.channel as string;

          const templates: Record<string, string> = {
            ugc_colombia: 'Agencia UGC Colombia. Creamos contenido auténtico que convierte. Hemos trabajado con marcas como X, Y, Z.',
            reyes_contenido: 'Comunidad de creadores de contenido más grande de Colombia. Mentoría, networking, oportunidades.',
            prolab: 'Proveeduría de dropshipping de productos de salud. Sin inventario, sin riesgo, márgenes del 40-60%.',
            infiny_latam: 'Agencia de marketing digital. Growth, ads, estrategia de contenido.',
            kreoon: 'Desarrollo de software y plataformas digitales.',
          };

          const response = await callLLM(
            [
              {
                role: 'system',
                content: `Genera un mensaje de outreach para ${channel} desde ${business}.
Contexto de la empresa: ${templates[business] || business}
Tono: Profesional pero cercano. NO suene genérico. Personaliza al máximo.
${channel === 'dm_instagram' ? 'Máximo 300 caracteres. Directo, sin formalidades excesivas.' : ''}
${channel === 'email' ? 'Subject line + body. Máximo 200 palabras.' : ''}
${channel === 'whatsapp' ? 'Mensaje corto, conversacional. Máximo 200 caracteres.' : ''}`,
              },
              {
                role: 'user',
                content: `Lead: ${args.lead_name}\nHandle: ${args.lead_handle || 'N/A'}\nContexto: ${args.lead_context}`,
              },
            ],
            { maxTokens: 500 },
          );

          return { outreach: response.text.trim(), channel, business };
        },

        update_lead_status: async (args) => {
          const leads = loadLeads();
          const lead = leads.find(l => l.id === args.lead_id);
          if (!lead) return { error: 'Lead no encontrado' };

          lead.status = args.status as Lead['status'];
          if (args.notes) lead.notes += `\n[${new Date().toISOString()}] ${args.notes}`;
          lead.lastContact = new Date().toISOString();
          saveLeads(leads);

          return { success: true, lead };
        },
      },
    });
  }
}

export const leadHunterAgent = new LeadHunterAgent();

// ─── Automated Lead Scan (called by cron) ────────────────────────────────────

export async function runDailyLeadScan(): Promise<string> {
  log.info('Starting daily lead scan...');

  const businesses = ['ugc_colombia', 'reyes_contenido', 'prolab'];
  const results: string[] = [];

  for (const biz of businesses) {
    try {
      const result = await leadHunterAgent.handle({
        agent: 'lead-hunter',
        message: { from: OWNER_PHONE, text: `Busca 5 leads para ${biz}`, type: 'text', timestamp: Date.now(), messageId: `cron-${Date.now()}` },
        member: { phone: OWNER_PHONE, name: 'Jarvis Cron', role: 'owner', email: 'founder@kreoon.com' },
        intent: `search_leads for ${biz}`,
      });
      results.push(`${biz}: ${result.text.slice(0, 200)}`);
    } catch (error: any) {
      results.push(`${biz}: Error - ${error.message}`);
    }
  }

  // Send summary to Alexander
  const summary = `*Lead Scan Diario*\n\n${results.join('\n\n')}`;
  await sendText(OWNER_PHONE, summary).catch(() => {});

  log.info('Daily lead scan completed');
  return summary;
}
