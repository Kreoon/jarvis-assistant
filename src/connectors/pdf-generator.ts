import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { agentLogger } from '../shared/logger.js';

export interface AnalysisReportData {
  originalUrl: string;
  platform: string;
  contentType: string;
  creator: string;
  caption: string;
  metrics: { views?: number; likes?: number; comments?: number; shares?: number };

  analysis: {
    hook: string;
    development: string;
    cta: string;
    format: string;
    copyFormula: string;
    powerWords: string;
    mentalTriggers: string;
    tone: string;
    funnelPosition: string;
    contentPillar: string;
    salesAngle: string;
    viralityScore: string;
    verdict: string;
  };

  wizard: {
    topic: string;
    objective: string;
    platform: string;
  };

  replicas: {
    faithful: string;
    improved: string;
    kreoon: string;
  };

  productionGuide?: string;
  publishStrategy?: string;
  successMetrics?: string;
}

const COLORS = {
  text: '#1a1a1a',
  accent: '#FF6B00',
  background: '#f5f5f5',
  white: '#ffffff',
  lightGray: '#e0e0e0',
  gray: '#666666',
};

const FONTS = {
  bold: 'Helvetica-Bold',
  regular: 'Helvetica',
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  tiktok: '🎵',
  youtube: '▶️',
  linkedin: '💼',
  twitter: '🐦',
  facebook: '👥',
  default: '📱',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return 'N/A';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function addPageFooter(doc: PDFKit.PDFDocument, dateStr: string): void {
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;
  const margin = 40;

  doc
    .moveTo(margin, pageHeight - 45)
    .lineTo(pageWidth - margin, pageHeight - 45)
    .strokeColor(COLORS.lightGray)
    .lineWidth(0.5)
    .stroke();

  doc
    .font(FONTS.regular)
    .fontSize(8)
    .fillColor(COLORS.gray)
    .text(
      `Generado por Jarvis — Kreoon UGC Agency  |  ${dateStr}`,
      margin,
      pageHeight - 35,
      { align: 'center', width: pageWidth - margin * 2 }
    );
}

function drawSectionHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  emoji: string = ''
): void {
  doc
    .rect(40, doc.y, doc.page.width - 80, 28)
    .fill(COLORS.accent);

  doc
    .font(FONTS.bold)
    .fontSize(12)
    .fillColor(COLORS.white)
    .text(`${emoji ? emoji + '  ' : ''}${title}`, 50, doc.y - 22, {
      width: doc.page.width - 100,
    });

  doc.moveDown(0.8);
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  maxWidth: number
): void {
  const startY = doc.y;
  doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.accent).text(label, x, startY, { width: maxWidth, continued: false });
  doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.text).text(value || 'N/A', x, doc.y, { width: maxWidth });
  doc.moveDown(0.3);
}

function drawBlockHeader(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(0.4);
  doc
    .font(FONTS.bold)
    .fontSize(10)
    .fillColor(COLORS.accent)
    .text(`▸ ${title}`, 40, doc.y, { width: doc.page.width - 80 });
  doc
    .moveTo(40, doc.y + 2)
    .lineTo(doc.page.width - 40, doc.y + 2)
    .strokeColor(COLORS.lightGray)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.4);
}

function drawTextBox(
  doc: PDFKit.PDFDocument,
  text: string,
  options: { label?: string; backgroundColor?: string } = {}
): void {
  const margin = 40;
  const boxX = margin;
  const boxWidth = doc.page.width - margin * 2;
  const paddingX = 10;
  const paddingY = 8;
  const textWidth = boxWidth - paddingX * 2;

  const startY = doc.y;

  // Measure text height
  const textHeight = doc.heightOfString(text, { width: textWidth, fontSize: 9 });
  const labelHeight = options.label ? 16 : 0;
  const totalHeight = textHeight + paddingY * 2 + labelHeight;

  doc
    .rect(boxX, startY, boxWidth, totalHeight)
    .fill(options.backgroundColor || COLORS.background);

  let textY = startY + paddingY;

  if (options.label) {
    doc
      .font(FONTS.bold)
      .fontSize(8)
      .fillColor(COLORS.accent)
      .text(options.label.toUpperCase(), boxX + paddingX, textY, { width: textWidth });
    textY += labelHeight;
  }

  doc
    .font(FONTS.regular)
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(text || 'N/A', boxX + paddingX, textY, { width: textWidth });

  doc.y = startY + totalHeight + 6;
}

export async function generateAnalysisReport(
  data: AnalysisReportData
): Promise<string> {
  const logger = agentLogger('pdf-generator');
  logger.info({ platform: data.platform, topic: data.wizard.topic }, 'Generating analysis PDF report');

  const tmpDir = '/app/data/tmp';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateSlug = now.toISOString().slice(0, 10);
  const topicSlug = slugify(data.wizard.topic || 'sin-tema');
  const platformSlug = slugify(data.platform || 'plataforma');
  const fileName = `analisis-${platformSlug}-${dateSlug}-${topicSlug}.pdf`;
  const filePath = path.join(tmpDir, fileName);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 60, left: 40, right: 40 },
    autoFirstPage: false,
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const pageWidth = doc.page.width;

  // ─────────────────────────────────────────
  // PORTADA
  // ─────────────────────────────────────────
  doc.addPage();

  const coverCenterX = 40;
  const coverWidth = pageWidth - 80;

  doc.moveDown(3);

  doc
    .font(FONTS.bold)
    .fontSize(52)
    .fillColor(COLORS.accent)
    .text('KREOON', coverCenterX, doc.y, { align: 'center', width: coverWidth });

  doc.moveDown(0.4);

  doc
    .font(FONTS.regular)
    .fontSize(18)
    .fillColor(COLORS.text)
    .text('Análisis & Plan de Réplica', coverCenterX, doc.y, {
      align: 'center',
      width: coverWidth,
    });

  doc.moveDown(2.5);

  doc
    .moveTo(40, doc.y)
    .lineTo(pageWidth - 40, doc.y)
    .strokeColor(COLORS.accent)
    .lineWidth(2)
    .stroke();

  doc.moveDown(1.5);

  const infoItems = [
    { label: 'URL Original', value: truncate(data.originalUrl, 80) },
    { label: 'Plataforma', value: data.platform },
    { label: 'Tema', value: data.wizard.topic },
    { label: 'Fecha', value: dateStr },
  ];

  for (const item of infoItems) {
    doc
      .font(FONTS.bold)
      .fontSize(11)
      .fillColor(COLORS.accent)
      .text(`${item.label}:`, 40, doc.y, { continued: true })
      .font(FONTS.regular)
      .fillColor(COLORS.text)
      .text(`  ${item.value}`, { width: coverWidth });
    doc.moveDown(0.5);
  }

  doc.moveDown(1.5);

  doc
    .moveTo(40, doc.y)
    .lineTo(pageWidth - 40, doc.y)
    .strokeColor(COLORS.lightGray)
    .lineWidth(1)
    .stroke();

  addPageFooter(doc, dateStr);

  // ─────────────────────────────────────────
  // SECCIÓN 1: ANÁLISIS DEL ORIGINAL
  // ─────────────────────────────────────────
  doc.addPage();

  const platformIcon =
    PLATFORM_ICONS[data.platform.toLowerCase()] || PLATFORM_ICONS.default;

  drawSectionHeader(doc, 'SECCIÓN 1: ANÁLISIS DEL ORIGINAL', platformIcon);

  // Creator + Metrics
  doc
    .font(FONTS.bold)
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(`Creator: `, 40, doc.y, { continued: true })
    .font(FONTS.regular)
    .text(data.creator || 'N/A');

  doc.moveDown(0.3);

  const metricsLine = [
    `👁 ${formatNumber(data.metrics.views)} vistas`,
    `❤️ ${formatNumber(data.metrics.likes)} likes`,
    `💬 ${formatNumber(data.metrics.comments)} comentarios`,
    `🔁 ${formatNumber(data.metrics.shares)} shares`,
  ].join('   ');

  doc
    .font(FONTS.regular)
    .fontSize(9)
    .fillColor(COLORS.gray)
    .text(metricsLine, 40, doc.y, { width: pageWidth - 80 });

  doc.moveDown(0.5);

  doc
    .font(FONTS.bold)
    .fontSize(9)
    .fillColor(COLORS.text)
    .text('Caption:', 40, doc.y);
  doc.moveDown(0.2);
  drawTextBox(doc, truncate(data.caption || '', 300));

  doc.moveDown(0.3);

  // Block 1: ESTRUCTURA
  drawBlockHeader(doc, 'ESTRUCTURA');
  drawLabelValue(doc, 'Hook:', data.analysis.hook, 40, pageWidth - 80);
  drawLabelValue(doc, 'Desarrollo:', data.analysis.development, 40, pageWidth - 80);
  drawLabelValue(doc, 'CTA:', data.analysis.cta, 40, pageWidth - 80);
  drawLabelValue(doc, 'Formato:', data.analysis.format, 40, pageWidth - 80);

  // Block 2: COPY
  drawBlockHeader(doc, 'COPY');
  drawLabelValue(doc, 'Fórmula Copy:', data.analysis.copyFormula, 40, pageWidth - 80);
  drawLabelValue(doc, 'Palabras de Poder:', data.analysis.powerWords, 40, pageWidth - 80);
  drawLabelValue(doc, 'Gatillos Mentales:', data.analysis.mentalTriggers, 40, pageWidth - 80);
  drawLabelValue(doc, 'Tono:', data.analysis.tone, 40, pageWidth - 80);

  // Block 3: ESTRATEGIA
  drawBlockHeader(doc, 'ESTRATEGIA');
  drawLabelValue(doc, 'Posición en Funnel:', data.analysis.funnelPosition, 40, pageWidth - 80);
  drawLabelValue(doc, 'Pilar de Contenido:', data.analysis.contentPillar, 40, pageWidth - 80);
  drawLabelValue(doc, 'Ángulo de Ventas:', data.analysis.salesAngle, 40, pageWidth - 80);
  drawLabelValue(doc, 'Score de Viralidad:', data.analysis.viralityScore, 40, pageWidth - 80);

  doc.moveDown(0.4);

  // Verdict box
  drawTextBox(doc, data.analysis.verdict, {
    label: '🏆 Veredicto',
    backgroundColor: '#fff3e0',
  });

  addPageFooter(doc, dateStr);

  // ─────────────────────────────────────────
  // SECCIÓN 2: PLAN DE RÉPLICA
  // ─────────────────────────────────────────
  doc.addPage();

  drawSectionHeader(doc, 'SECCIÓN 2: PLAN DE RÉPLICA', '🔁');

  // Wizard answers
  drawBlockHeader(doc, 'Configuración del Wizard');
  drawLabelValue(doc, 'Tema:', data.wizard.topic, 40, pageWidth - 80);
  drawLabelValue(doc, 'Objetivo:', data.wizard.objective, 40, pageWidth - 80);
  drawLabelValue(doc, 'Plataforma destino:', data.wizard.platform, 40, pageWidth - 80);

  doc.moveDown(0.4);

  drawBlockHeader(doc, 'Versión 1: Réplica Fiel');
  drawTextBox(doc, data.replicas.faithful);

  drawBlockHeader(doc, 'Versión 2: Mejorada');
  drawTextBox(doc, data.replicas.improved);

  drawBlockHeader(doc, 'Versión 3: Kreoon UGC');
  drawTextBox(doc, data.replicas.kreoon, { backgroundColor: '#fff3e0' });

  addPageFooter(doc, dateStr);

  // ─────────────────────────────────────────
  // SECCIÓN 3: GUÍA DE PRODUCCIÓN
  // ─────────────────────────────────────────
  doc.addPage();

  drawSectionHeader(doc, 'SECCIÓN 3: GUÍA DE PRODUCCIÓN', '🎬');

  doc
    .font(FONTS.regular)
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(data.productionGuide || 'No se generó guía de producción.', 40, doc.y, {
      width: pageWidth - 80,
      lineGap: 2,
    });

  addPageFooter(doc, dateStr);

  // ─────────────────────────────────────────
  // SECCIÓN 4: ESTRATEGIA DE PUBLICACIÓN
  // ─────────────────────────────────────────
  doc.addPage();

  drawSectionHeader(doc, 'SECCIÓN 4: ESTRATEGIA DE PUBLICACIÓN', '📅');

  doc
    .font(FONTS.regular)
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(
      data.publishStrategy || 'No se generó estrategia de publicación.',
      40,
      doc.y,
      { width: pageWidth - 80, lineGap: 2 }
    );

  addPageFooter(doc, dateStr);

  // ─────────────────────────────────────────
  // SECCIÓN 5: MÉTRICAS DE ÉXITO
  // ─────────────────────────────────────────
  doc.addPage();

  drawSectionHeader(doc, 'SECCIÓN 5: MÉTRICAS DE ÉXITO', '📊');

  doc
    .font(FONTS.regular)
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(
      data.successMetrics || 'No se generaron métricas de éxito.',
      40,
      doc.y,
      { width: pageWidth - 80, lineGap: 2 }
    );

  addPageFooter(doc, dateStr);

  // ─────────────────────────────────────────
  // Finalize
  // ─────────────────────────────────────────
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  logger.info({ filePath }, 'PDF report generated successfully');
  return filePath;
}
