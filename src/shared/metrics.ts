// Simple in-memory metrics counters

interface Metrics {
  totalMessages: number;
  agentRequests: Record<string, number>;
  errors: number;
  startedAt: string;
}

const metrics: Metrics = {
  totalMessages: 0,
  agentRequests: {},
  errors: 0,
  startedAt: new Date().toISOString(),
};

export function incrementMessages(): void {
  metrics.totalMessages++;
}

export function incrementAgent(agentName: string): void {
  metrics.agentRequests[agentName] = (metrics.agentRequests[agentName] || 0) + 1;
}

export function incrementErrors(): void {
  metrics.errors++;
}

export function getMetrics() {
  return {
    ...metrics,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}
