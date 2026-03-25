// === Mensajes WhatsApp ===
export interface WAMessage {
  from: string;
  name?: string;
  type: 'text' | 'audio' | 'image' | 'document' | 'location' | 'reaction';
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  caption?: string;
  timestamp: number;
  messageId: string;
}

// === Roles del equipo ===
export type RoleName = 'owner' | 'ops' | 'sales' | 'community' | 'readonly';

export interface TeamMember {
  phone: string;
  name: string;
  role: RoleName;
  email: string;
}

// === Sistema de Agentes ===
export type AgentName = 'core' | 'memory' | 'content' | 'ops' | 'analyst' | 'engine';

export interface AgentRequest {
  agent: AgentName;
  message: WAMessage;
  member: TeamMember;
  context?: ConversationContext;
  intent?: string;
}

export interface AgentResponse {
  text: string;
  media?: MediaAttachment[];
  actions?: AgentAction[];
  memoryOps?: MemoryOp[];
}

export interface AgentAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface MediaAttachment {
  type: 'image' | 'audio' | 'document' | 'video';
  url?: string;
  buffer?: Buffer;
  mimeType: string;
  filename?: string;
  caption?: string;
}

// === Memoria ===
export interface MemoryOp {
  action: 'store' | 'retrieve' | 'search' | 'delete';
  key?: string;
  value?: unknown;
  query?: string;
  namespace?: string;
}

export interface ConversationContext {
  recentMessages: { role: 'user' | 'assistant'; content: string }[];
  activeReminders?: Reminder[];
  userMemory?: Record<string, unknown>;
  activeSkills?: string[];
}

// === Recordatorios ===
export interface Reminder {
  id: string;
  phone: string;
  text: string;
  triggerAt: Date;
  recurring?: string; // cron expression
  source: 'manual' | 'calendar';
  calendarEventId?: string;
}

// === Scheduler ===
export interface ScheduledJob {
  id: string;
  cron: string;
  description: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

// === Daily Content Engine ===
export interface ContentIdea {
  title: string;
  angle: string;
  relevance: string;
  platform: string;
  funnelPosition: 'TOFU' | 'MOFU' | 'BOFU';
  contentPillar: string;
}

export interface ReelStructure {
  creator: {
    script: string;
    timing: string;
    deliveryNotes: string;
  };
  producer: {
    shotList: string;
    transitions: string;
    textOverlays: string;
    music: string;
    specs: string;
  };
  strategist: {
    funnelPosition: string;
    pillar: string;
    objective: string;
    kpis: string;
    schedule: string;
    repurposing: string;
  };
  trafficker: {
    adScore: number;
    targeting: string;
    budget: string;
    paidCTA: string;
  };
  communityManager: {
    caption: string;
    hashtags: string;
    engagement: string;
    replyTemplates: string;
    crossPosting: string;
  };
}

export interface DailyReport {
  date: string;
  emailSummary: string;
  webTrends: string;
  ideas: (ContentIdea & { structure: ReelStructure })[];
  generatedAt: string;
  tokensUsed?: number;
}

// === LLM ===
export type LLMProvider = 'claude' | 'gemini';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
  provider: LLMProvider;
  tokensUsed?: number;
}
