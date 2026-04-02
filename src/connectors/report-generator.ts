import axios from 'axios';
import { logger } from '../shared/logger.js';
import type { DailyReport } from '../shared/types.js';

const REPORTS_API = 'https://kreoon-reports-v2.vercel.app/api/reports';

export async function postDailyReport(report: DailyReport): Promise<string | null> {
  try {
    const { data } = await axios.post(
      REPORTS_API,
      {
        type: 'daily-briefing',
        date: report.date,
        data: report,
        createdAt: new Date().toISOString(),
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      },
    );

    const url = data?.url || (data?.id
      ? `${REPORTS_API.replace('/api/reports', '')}/reports/${data.id}`
      : null);

    logger.info({ reportId: data?.id, url }, 'Daily briefing posted to web app');
    return url;
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Failed to post report to web app');
    return null;
  }
}

export function formatReportMarkdown(report: DailyReport): string {
  const lines: string[] = [
    `# Daily Briefing — Alexander Cast — ${report.date}`,
    '',
    `> Generado: ${report.generatedAt}`,
    `> Cuentas escaneadas: ${report.accountsScanned.join(', ') || 'ninguna'}`,
    '',
    '## Nuggets de Newsletters',
    '',
    report.emailSummary || '_Sin newsletters relevantes hoy._',
    '',
    '## Tendencias del Día',
    '',
    report.webTrends || '_Sin tendencias detectadas._',
    '',
    '---',
    '',
  ];

  for (let i = 0; i < report.ideas.length; i++) {
    const idea = report.ideas[i];
    const s = idea.videoScript;

    lines.push(`## Guión ${i + 1}: ${idea.title}`);
    lines.push('');
    lines.push(`**Ángulo:** ${idea.angle}`);
    lines.push(`**Por qué hoy:** ${idea.whyToday}`);
    lines.push(`**Plataforma:** ${idea.platform} | **Viral Score:** ${idea.viralScore}/10 | **Duración:** ${s.duration}`);
    lines.push('');

    lines.push('### Hook');
    lines.push(`> ${s.hook}`);
    lines.push('');

    lines.push('### Guión de Voz');
    lines.push(s.voiceScript);
    lines.push('');

    lines.push('### Guión Visual');
    lines.push(s.visualScript);
    lines.push('');

    lines.push('### Guión de Edición');
    lines.push(s.editingScript);
    lines.push('');

    lines.push('### Caption');
    lines.push(s.caption);
    lines.push('');

    lines.push('### Hashtags');
    lines.push(s.hashtags);
    lines.push('');

    lines.push('### CTA');
    lines.push(s.cta);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function formatWhatsAppSummary(report: DailyReport, webUrl?: string | null): string {
  const lines: string[] = [
    `*Daily Briefing — ${report.date}*`,
    '',
  ];

  for (let i = 0; i < report.ideas.length; i++) {
    const idea = report.ideas[i];
    const s = idea.videoScript;

    lines.push(`*${i + 1}. ${idea.title}*`);
    lines.push(`_"${s.hook}"_`);
    lines.push(`${idea.platform} | ${s.duration} | Viral: ${idea.viralScore}/10`);
    lines.push('');
  }

  if (webUrl) {
    lines.push(`Guiones completos: ${webUrl}`);
  } else {
    lines.push('_Guiones guardados en Obsidian._');
  }

  return lines.join('\n');
}
