// ═══ Brand Researcher Types ═══

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO datetime
  end: string;
  status: string;
  attendees: CalendarAttendee[];
  htmlLink?: string;
  created?: string;
}

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  self?: boolean;
}

export interface BrandResearchResult {
  // Source
  attendee_email: string;
  attendee_name: string;
  meeting_date: string;
  meeting_title: string;
  calendar_event_id: string;

  // Brand info
  brand_name: string;
  brand_website: string | null;
  brand_industry: string;
  brand_description: string;

  // Social presence
  social_profiles: SocialProfile[];

  // Content analysis
  posts_analyzed: AnalyzedPost[];

  // Strategic diagnosis
  funnel_coverage: FunnelCoverage;
  pillar_distribution: PillarDistribution;
  hook_patterns: string[];
  overall_score: number; // 0-100
  scores: BrandScores;
  opportunities: Opportunity[];

  // Proposal
  service_proposal: ServiceProposal;
}

export interface SocialProfile {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'twitter' | 'facebook';
  username: string;
  url: string;
  followers?: number;
  posts_per_week?: number;
  engagement_rate?: number;
  bio?: string;
}

export interface AnalyzedPost {
  url: string;
  platform: string;
  caption: string;
  likes?: number;
  views?: number;
  comments?: number;
  thumbnail_url?: string;
  published_at?: string;
  score?: number; // 0-100
  analysis?: string; // Gemini visual analysis summary
  content_type?: string;
}

export interface FunnelCoverage {
  tofu: number; // 0-100
  mofu: number;
  bofu: number;
}

export interface PillarDistribution {
  educar: number; // percentage
  entretener: number;
  inspirar: number;
  vender: number;
}

export interface BrandScores {
  content_quality: number; // 0-100
  strategy: number;
  consistency: number;
  engagement: number;
  branding: number;
}

export interface Opportunity {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  priority: number; // 1-5
}

export interface ServiceProposal {
  packages: ServicePackage[];
  recommended: string; // package name
  pricing_note: string;
}

export interface ServicePackage {
  name: string;
  description: string;
  includes: string[];
  price_range: string;
  ideal_for: string;
}

export interface ProcessedMeeting {
  eventId: string;
  processedAt: string;
  attendeeEmail: string;
  reportUrl?: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
}
