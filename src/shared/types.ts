// === Mensajes WhatsApp ===
export interface WAMessage {
  from: string;
  name?: string;
  type: 'text' | 'audio' | 'image' | 'video' | 'document' | 'location' | 'reaction';
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  caption?: string;
  timestamp: number;
  messageId: string;
  platform?: 'whatsapp' | 'web';
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
export type AgentName = 'core' | 'memory' | 'content' | 'ops' | 'analyst' | 'engine' | 'social' | 'lead-hunter' | 'task-agent';

export interface AgentRequest {
  agent: AgentName;
  message: WAMessage;
  member: TeamMember;
  context?: ConversationContext;
  intent?: string;
  directMedia?: {
    localFilePath: string;
    mimeType: string;
    caption?: string;
    isVideo: boolean;
  };
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

// === Daily Briefing Engine (Alexander Cast) ===
export interface ContentIdea {
  title: string;
  angle: string;
  whyToday: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'linkedin';
  viralScore: number;
}

export interface VideoScript {
  hook: string;
  duration: '30s' | '60s' | '90s';
  voiceScript: string;
  visualScript: string;
  editingScript: string;
  caption: string;
  hashtags: string;
  cta: string;
}

export interface DailyReport {
  date: string;
  emailSummary: string;
  webTrends: string;
  ideas: (ContentIdea & { videoScript: VideoScript })[];
  generatedAt: string;
  accountsScanned: string[];
}

// === LLM ===
export type LLMProvider = 'claude' | 'gemini' | 'groq' | 'openrouter';

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
