import { exec } from 'child_process';
import { agentLogger } from '../shared/logger.js';

const log = agentLogger('openclaw-connector');

const OPENCLAW_CONTAINER = process.env.OPENCLAW_CONTAINER || 'jarvis-openclaw';
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'jarvis-internal-2024';
const OPENCLAW_TIMEOUT = parseInt(process.env.OPENCLAW_TIMEOUT || '120', 10);

let _available = false;

export function initOpenClaw(): void {
  checkAvailability();
}

async function checkAvailability(): Promise<void> {
  try {
    await runOpenClawCommand('gateway call health');
    _available = true;
    log.info('OpenClaw gateway is available via CLI');
  } catch (err: any) {
    _available = false;
    log.warn({ error: err.message }, 'OpenClaw not available (will retry on next call)');
  }
}

export function isOpenClawConnected(): boolean {
  return _available;
}

function runOpenClawCommand(command: string, timeoutSec = 30): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullCmd = `docker exec -e OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_TOKEN} ${OPENCLAW_CONTAINER} openclaw ${command}`;

    exec(fullCmd, {
      timeout: timeoutSec * 1000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout) => {
      if (error) {
        reject(new Error(error.message));
        return;
      }
      const cleanOutput = stdout
        .split('\n')
        .filter(line => !line.includes('amazon-bedrock') && !line.includes('Require stack'))
        .join('\n')
        .trim();
      resolve(cleanOutput);
    });
  });
}

export async function delegateToOpenClaw(message: string, context?: Record<string, any>): Promise<string> {
  const start = Date.now();
  const agentId = context?.agent || 'main';
  const escapedMessage = message.replace(/'/g, "'\\''");

  log.info({ messageLength: message.length, agent: agentId }, 'Delegating task to OpenClaw via CLI');

  try {
    const result = await runOpenClawCommand(
      `agent --agent main --message '${escapedMessage}' --timeout ${OPENCLAW_TIMEOUT}`,
      OPENCLAW_TIMEOUT + 10,
    );

    const duration = Math.round((Date.now() - start) / 1000);
    log.info({ duration: `${duration}s`, resultLength: result.length }, 'OpenClaw task completed');

    _available = true;
    return result || 'OpenClaw procesó la tarea pero no generó respuesta.';
  } catch (err: any) {
    const duration = Math.round((Date.now() - start) / 1000);
    log.error({ error: err.message, duration: `${duration}s` }, 'OpenClaw delegation failed');

    _available = false;
    checkAvailability();

    throw new Error(`Error en OpenClaw: ${err.message}`);
  }
}

export async function queryOpenClawSkill(skillName: string, params: Record<string, any>): Promise<any> {
  const paramsStr = JSON.stringify(params).replace(/'/g, "'\\''");
  const message = `Usa el skill "${skillName}" con estos parámetros: ${paramsStr}`;
  return delegateToOpenClaw(message, { agent: 'main' });
}
