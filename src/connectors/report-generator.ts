import axios from 'axios';
import { logger } from '../shared/logger.js';
import type { DailyReport } from '../shared/types.js';

const REPORTS_API = 'https://kreoon-reports-v2.vercel.app/api/reports';

export async function postDailyReport(report: DailyReport): Promise<string | null> {
  try {
    const { data } = await axios.post(
      REPORTS_API,
      {
        type: 'daily-content-engine',
        date: report.date,
        data: report,
        createdAt: new Date().toISOString(),
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      },
    );

    const url = data?.url || data?.id
      ? `${REPORTS_API.replace('/api/reports', '')}/reports/${data.id}`
      : null;

    logger.info({ reportId: data?.id }, 'Daily report posted to web app');
    return url;
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Failed to post report to web app, will save locally');
    return null;
  }
}

export function formatReportMarkdown(report: DailyReport): string {
  const lines: string[] = [
    `# Daily Content Engine — ${report.date}`,
    '',
    `> Generado: ${report.generatedAt}`,
    '',
    '## Resumen de Emails Relevantes',
    '',
    report.emailSummary || '_Sin emails relevantes hoy._',
    '',
    '## Tendencias Web',
    '',
    report.webTrends || '_Sin tendencias detectadas._',
    '',
    '---',
    '',
  ];

  for (let i = 0; i < report.ideas.length; i++) {
    const idea = report.ideas[i];
    lines.push(`## Idea ${i + 1}: ${idea.title}`);
    lines.push('');
    lines.push(`**Ángulo:** ${idea.angle}`);
    lines.push(`**Relevancia:** ${idea.relevance}`);
    lines.push(`**Plataforma:** ${idea.platform} | **Funnel:** ${idea.funnelPosition} | **Pilar:** ${idea.contentPillar}`);
    lines.push('');

    const s = idea.structure;

    lines.push('### Creator');
    lines.push('');
    lines.push('**Script:**');
    lines.push(s.creator.script);
    lines.push('');
    lines.push(`**Timing:** ${s.creator.timing}`);
    lines.push(`**Delivery Notes:** ${s.creator.deliveryNotes}`);
    lines.push('');

    lines.push('### Producer/Editor');
    lines.push('');
    lines.push(`**Shot List:** ${s.producer.shotList}`);
    lines.push(`**Transiciones:** ${s.producer.transitions}`);
    lines.push(`**Text Overlays:** ${s.producer.textOverlays}`);
    lines.push(`**Música:** ${s.producer.music}`);
    lines.push(`**Specs:** ${s.producer.specs}`);
    lines.push('');

    lines.push('### Strategist');
    lines.push('');
    lines.push(`**Funnel:** ${s.strategist.funnelPosition}`);
    lines.push(`**Pilar:** ${s.strategist.pillar}`);
    lines.push(`**Objetivo:** ${s.strategist.objective}`);
    lines.push(`**KPIs:** ${s.strategist.kpis}`);
    lines.push(`**Schedule:** ${s.strategist.schedule}`);
    lines.push(`**Repurposing:** ${s.strategist.repurposing}`);
    lines.push('');

    lines.push('### Trafficker');
    lines.push('');
    lines.push(`**Ad Score:** ${s.trafficker.adScore}/10`);
    lines.push(`**Targeting:** ${s.trafficker.targeting}`);
    lines.push(`**Budget:** ${s.trafficker.budget}`);
    lines.push(`**CTA Pagado:** ${s.trafficker.paidCTA}`);
    lines.push('');

    lines.push('### Community Manager');
    lines.push('');
    lines.push(`**Caption:** ${s.communityManager.caption}`);
    lines.push(`**Hashtags:** ${s.communityManager.hashtags}`);
    lines.push(`**Engagement:** ${s.communityManager.engagement}`);
    lines.push(`**Reply Templates:** ${s.communityManager.replyTemplates}`);
    lines.push(`**Cross-posting:** ${s.communityManager.crossPosting}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function formatWhatsAppSummary(report: DailyReport): string {
  const lines: string[] = [
    `🚀 *Daily Content Engine — ${report.date}*`,
    '',
  ];

  if (report.emailSummary) {
    lines.push('📧 *Emails relevantes:*');
    lines.push(report.emailSummary.slice(0, 300));
    lines.push('');
  }

  if (report.webTrends) {
    lines.push('🌐 *Tendencias:*');
    lines.push(report.webTrends.slice(0, 300));
    lines.push('');
  }

  lines.push(`📝 *${report.ideas.length} ideas generadas:*`);
  lines.push('');

  for (let i = 0; i < report.ideas.length; i++) {
    const idea = report.ideas[i];
    lines.push(`*${i + 1}. ${idea.title}*`);
    lines.push(`   ${idea.platform} | ${idea.funnelPosition} | ${idea.contentPillar}`);
    lines.push(`   _${idea.angle}_`);
    lines.push('');
  }

  lines.push('_Reporte completo guardado en Obsidian._');

  return lines.join('\n');
}
