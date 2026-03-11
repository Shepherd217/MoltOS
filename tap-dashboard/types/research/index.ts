/**
 * ClawResearch - Native Research System for MoltOS
 * Types and interfaces for the research engine
 */

export type ResearchDepth = 'quick' | 'deep' | 'trend' | 'competitive';
export type ResearchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SourceType = 'arxiv' | 'web' | 'rss' | 'moltbook' | 'document' | 'news';

export interface ResearchJob {
  id: string;
  query: string;
  depth: ResearchDepth;
  status: ResearchStatus;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  sources: SourceType[];
  options?: ResearchOptions;
  result?: ResearchResult;
  metadata: ResearchMetadata;
}

export interface ResearchOptions {
  maxSources?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  domains?: string[];
  excludeDomains?: string[];
  entities?: string[];
  language?: string;
  factCheck?: boolean;
  includeContradictions?: boolean;
  saveToMemory?: boolean;
}

export interface ResearchMetadata {
  agentId?: string;
  sessionId?: string;
  tags?: string[];
  relatedJobs?: string[];
}

export interface ResearchResult {
  executiveSummary: string;
  keyFindings: Finding[];
  citations: Citation[];
  contradictions: Contradiction[];
  gaps: string[];
  stats: ResearchStats;
  timeline?: TimelineEvent[];
}

export interface Finding {
  id: string;
  statement: string;
  confidence: number;
  sources: string[];
  category?: string;
  evidence: Evidence[];
  verified: boolean;
}

export interface Evidence {
  type: 'quote' | 'statistic' | 'expert' | 'study';
  content: string;
  source: string;
  context?: string;
}

export interface Citation {
  id: string;
  url: string;
  title: string;
  source: SourceType;
  credibilityScore: number;
  publishedAt?: Date;
  accessedAt: Date;
  excerpt?: string;
  author?: string;
  domain: string;
}

export interface Contradiction {
  id: string;
  claimA: string;
  claimB: string;
  sourceA: string;
  sourceB: string;
  severity: 'low' | 'medium' | 'high';
  resolution?: string;
}

export interface ResearchStats {
  totalSources: number;
  avgCredibility: number;
  factCheckPassRate: number;
  processingTimeMs: number;
  sourcesByType: Record<SourceType, number>;
}

export interface TimelineEvent {
  date: Date;
  title: string;
  description: string;
  significance: number;
  sources: string[];
}

export interface RawSource {
  type: SourceType;
  url: string;
  title: string;
  content: string;
  publishedAt?: Date;
  author?: string;
  metadata?: Record<string, any>;
}

export interface SourceAdapter {
  name: SourceType;
  search(query: string, options: ResearchOptions): Promise<RawSource[]>;
  fetch(url: string): Promise<RawSource>;
  getCredibilityScore(source: RawSource): number;
}

export interface ResearchMemory {
  id: string;
  query: string;
  findings: string[];
  timestamp: Date;
  accessCount: number;
  relatedQueries: string[];
}

export interface FactCheckResult {
  claim: string;
  verified: boolean;
  confidence: number;
  supportingSources: string[];
  contradictingSources: string[];
  explanation: string;
}

export interface CompetitiveAnalysis {
  entities: string[];
  comparisonMatrix: Record<string, Record<string, any>>;
  strengths: Record<string, string[]>;
  weaknesses: Record<string, string[]>;
  opportunities: Record<string, string[]>;
  threats: Record<string, string[]>;
  marketPosition: Record<string, number>;
}
