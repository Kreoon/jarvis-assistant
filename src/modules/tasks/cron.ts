import cron from 'node-cron';
import { config } from '../../shared/config.js';
import { logger } from '../../shared/logger.js';
import { getWeeklyReport } from './service.js';
import { saveWeeklyReport } from '../../connectors/obsidian-sync.js';

const log = logger.child({ module: 'task-cron' });

export function initTaskCrons(): void {
  const cronExpr = config.tasks.weeklyReportCron;

  if (!cron.validate(cronExpr)) {
    log.warn({ cron: cronExpr }, 'Invalid TASKS_WEEKLY_REPORT_CRON — weekly report disabled');
    return;
  }

  cron.schedule(cronExpr, async () => {
    log.info('Running weekly task report');
    try {
      const report = await getWeeklyReport(0);
      await saveWeeklyReport(report);
      log.info({ week: report.weekLabel, total: report.totalCompleted }, 'Weekly report saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ error: msg }, 'Weekly task report failed');
    }
  });

  log.info({ cron: cronExpr }, 'Task weekly report cron initialized');
}
