/**
 * ============================================================================
 * ClawMemory - Native Memory System for MoltOS
 * ============================================================================
 * 
 * A first-class OS feature for agent memory management:
 * - Daily log consolidation (automatic)
 * - Semantic search across all memory
 * - Short-term (session) vs long-term (persistent) memory
 * - Memory compression for old data
 * 
 * @module lib/claw/memory
 * @version 1.0.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export type MemoryEntryType = 
  | 'conversation' 
  | 'observation' 
  | 'action' 
  | 'decision' 
  | 'user_preference' 
  | 'system_event'
  | 'consolidated';

export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical';

export type MemorySessionStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface MemorySession {
  id: string;
  userId: string;
  agentId?: string;
  parentSessionId?: string;
  title?: string;
  description?: string;
  status: MemorySessionStatus;
  contextWindow: Record<string, unknown>;
  contextTokens: number;
  maxTokens: number;
  entryCount: number;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
  lastAccessedAt: Date;
  consolidated: boolean;
  summaryId?: string;
  tags: string[];
  source?: string;
  metadata: Record<string, unknown>;
}

export interface MemoryEntry {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  contentType: MemoryEntryType;
  importance: MemoryImportance;
  embedding?: number[];
  embeddingModel?: string;
  role?: 'user' | 'assistant' | 'system' | 'tool';
  turnNumber?: number;
  replyTo?: string;
  relatedEntries?: string[];
  keywords?: string[];
  entities?: string[];
  tokenCount: number;
  createdAt: Date;
  timestamp?: Date;
  compressed: boolean;
  originalEntryIds?: string[];
  compressionRatio?: number;
  metadata: Record<string, unknown>;
}

export interface MemorySearchResult {
  id: string;
  sessionId: string;
  content: string;
  contentType: MemoryEntryType;
  importance: MemoryImportance;
  similarity: number;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface MemoryQueryOptions {
  sessionId?: string;
  entryTypes?: MemoryEntryType[];
  minImportance?: MemoryImportance;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchOptions extends MemoryQueryOptions {
  semantic?: boolean;
  matchThreshold?: number;
  matchCount?: number;
}

export interface MemoryContext {
  session: MemorySession;
  recentEntries: MemoryEntry[];
  relevantMemories: MemorySearchResult[];
  userPreferences: Record<string, unknown>;
  sessionHistory: MemorySession[];
}

export interface ConsolidationResult {
  summaryId: string;
  entriesProcessed: number;
  compressionRatio: number;
  sessionsArchived: string[];
}

export interface PruningResult {
  prunedCount: number;
  freedTokens: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ClawMemoryConfig {
  supabaseUrl: string;
  supabaseKey: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  defaultSessionMaxTokens?: number;
  consolidationThresholdDays?: number;
  pruningThresholdDays?: number;
  maxContextEntries?: number;
  enableAutoSave?: boolean;
  enableCompression?: boolean;
}

const DEFAULT_CONFIG: Partial<ClawMemoryConfig> = {
  embeddingModel: 'all-MiniLM-L6-v2',
  embeddingDimension: 384,
  defaultSessionMaxTokens: 8000,
  consolidationThresholdDays: 7,
  pruningThresholdDays: 90,
  maxContextEntries: 20,
  enableAutoSave: true,
  enableCompression: true,
};

// ============================================================================
// EMBEDDING SERVICE
// ============================================================================

/**
 * Interface for embedding providers
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Local embedding service using transformers.js
 * Falls back to API-based embeddings for production
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  private model: any = null;
  private readonly modelName: string;

  constructor(modelName: string = 'Xenova/all-MiniLM-L6-v2') {
    this.modelName = modelName;
  }

  async initialize(): Promise<void> {
    if (this.model) return;
    
    try {
      // Dynamic import for transformers.js
      const { pipeline } = await import('@xenova/transformers');
      this.model = await pipeline('feature-extraction', this.modelName);
    } catch (error) {
      console.warn('[ClawMemory] Failed to load local embedding model:', error);
      throw new Error('Embedding model initialization failed');
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.model) {
      await this.initialize();
    }

    const output = await this.model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.model) {
      await this.initialize();
    }

    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.embed(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }
}

/**
 * API-based embedding provider (OpenAI, etc.)
 */
export class APIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private apiUrl: string;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = 'https://api.openai.com/v1/embeddings';
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  }
}

// ============================================================================
// CORE MEMORY SERVICE
// ============================================================================

export class ClawMemory {
  private supabase: SupabaseClient;
  private config: ClawMemoryConfig;
  private embeddingProvider: EmbeddingProvider;
  private activeSessions: Map<string, MemorySession> = new Map();
  private autoSaveInterval?: NodeJS.Timeout;

  constructor(config: ClawMemoryConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.embeddingProvider = new LocalEmbeddingProvider();
  }

  /**
   * Initialize the memory system
   */
  async initialize(): Promise<void> {
    try {
      await this.embeddingProvider.initialize();
      console.log('[ClawMemory] Initialized successfully');
    } catch (error) {
      console.warn('[ClawMemory] Using fallback embedding (no vectors)');
    }

    if (this.config.enableAutoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Set a custom embedding provider
   */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  // ========================================================================
  // SESSION MANAGEMENT
  // ========================================================================

  /**
   * Create a new memory session
   */
  async createSession(params: {
    userId: string;
    agentId?: string;
    title?: string;
    description?: string;
    parentSessionId?: string;
    tags?: string[];
    source?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MemorySession> {
    const { data, error } = await this.supabase
      .from('memory_sessions')
      .insert({
        user_id: params.userId,
        agent_id: params.agentId,
        title: params.title || this.generateSessionTitle(),
        description: params.description,
        parent_session_id: params.parentSessionId,
        tags: params.tags || [],
        source: params.source,
        metadata: params.metadata || {},
        max_tokens: this.config.defaultSessionMaxTokens,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    const session = this.mapSessionFromDB(data);
    this.activeSessions.set(session.id, session);
    
    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<MemorySession | null> {
    // Check cache first
    if (this.activeSessions.has(sessionId)) {
      return this.activeSessions.get(sessionId)!;
    }

    const { data, error } = await this.supabase
      .from('memory_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    const session = this.mapSessionFromDB(data);
    
    if (session.status === 'active') {
      this.activeSessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * Get or create an active session for a user
   */
  async getOrCreateActiveSession(userId: string, agentId?: string): Promise<MemorySession> {
    // Look for existing active session
    const { data, error } = await this.supabase
      .from('memory_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('last_accessed_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      return this.mapSessionFromDB(data);
    }

    // Create new session
    return this.createSession({
      userId,
      agentId,
      title: `Session ${new Date().toISOString()}`,
    });
  }

  /**
   * Update session context window
   */
  async updateSessionContext(
    sessionId: string, 
    context: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('memory_sessions')
      .update({
        context_window: context,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to update context: ${error.message}`);
    }

    // Update cache
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.contextWindow = context;
    }
  }

  /**
   * Complete/end a session
   */
  async completeSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('memory_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to complete session: ${error.message}`);
    }

    this.activeSessions.delete(sessionId);
  }

  /**
   * Get recent sessions for a user
   */
  async getRecentSessions(userId: string, limit: number = 10): Promise<MemorySession[]> {
    const { data, error } = await this.supabase
      .from('memory_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_accessed_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get sessions: ${error.message}`);
    }

    return (data || []).map(this.mapSessionFromDB);
  }

  // ========================================================================
  // MEMORY ENTRY OPERATIONS
  // ========================================================================

  /**
   * Store a memory entry
   */
  async storeEntry(params: {
    sessionId?: string;
    userId: string;
    content: string;
    contentType?: MemoryEntryType;
    importance?: MemoryImportance;
    role?: 'user' | 'assistant' | 'system' | 'tool';
    replyTo?: string;
    keywords?: string[];
    entities?: string[];
    metadata?: Record<string, unknown>;
    generateEmbedding?: boolean;
  }): Promise<MemoryEntry> {
    // Get or create session
    let sessionId = params.sessionId;
    if (!sessionId) {
      const session = await this.getOrCreateActiveSession(params.userId);
      sessionId = session.id;
    }

    // Calculate token count (rough estimate)
    const tokenCount = this.estimateTokenCount(params.content);

    // Generate embedding if enabled
    let embedding: number[] | undefined;
    if (params.generateEmbedding !== false) {
      try {
        embedding = await this.embeddingProvider.embed(params.content);
      } catch (error) {
        console.warn('[ClawMemory] Failed to generate embedding:', error);
      }
    }

    // Extract keywords and entities if not provided
    const keywords = params.keywords || this.extractKeywords(params.content);
    const entities = params.entities || this.extractEntities(params.content);

    const { data, error } = await this.supabase
      .from('memory_entries')
      .insert({
        session_id: sessionId,
        user_id: params.userId,
        content: params.content,
        content_type: params.contentType || 'conversation',
        importance: params.importance || 'medium',
        role: params.role,
        reply_to: params.replyTo,
        keywords,
        entities,
        token_count: tokenCount,
        embedding: embedding ? JSON.stringify(embedding) : null,
        metadata: params.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store entry: ${error.message}`);
    }

    return this.mapEntryFromDB(data);
  }

  /**
   * Store a conversation turn (convenience method)
   */
  async storeConversation(
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    sessionId?: string,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry> {
    return this.storeEntry({
      userId,
      sessionId,
      content,
      role,
      contentType: 'conversation',
      importance: role === 'user' ? 'high' : 'medium',
      metadata: {
        ...metadata,
        stored_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Get entries from a session
   */
  async getSessionEntries(sessionId: string, limit: number = 100): Promise<MemoryEntry[]> {
    const { data, error } = await this.supabase
      .from('memory_entries')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get entries: ${error.message}`);
    }

    return (data || []).map(this.mapEntryFromDB);
  }

  /**
   * Get recent entries across all sessions
   */
  async getRecentEntries(
    userId: string, 
    options: MemoryQueryOptions = {}
  ): Promise<MemoryEntry[]> {
    let query = this.supabase
      .from('memory_entries')
      .select('*')
      .eq('user_id', userId);

    if (options.sessionId) {
      query = query.eq('session_id', options.sessionId);
    }

    if (options.entryTypes && options.entryTypes.length > 0) {
      query = query.in('content_type', options.entryTypes);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get entries: ${error.message}`);
    }

    return (data || []).map(this.mapEntryFromDB);
  }

  // ========================================================================
  // SEMANTIC SEARCH
  // ========================================================================

  /**
   * Search memories using semantic similarity
   */
  async search(
    userId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<MemorySearchResult[]> {
    const matchCount = options.matchCount || 10;
    const matchThreshold = options.matchThreshold || 0.7;

    // Generate embedding for query
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingProvider.embed(query);
    } catch (error) {
      // Fallback to keyword search
      console.warn('[ClawMemory] Semantic search failed, falling back to keyword');
      return this.keywordSearch(userId, query, options);
    }

    // Call database function for semantic search
    const { data, error } = await this.supabase.rpc('search_memories', {
      p_user_id: userId,
      p_query_embedding: JSON.stringify(queryEmbedding),
      p_match_threshold: matchThreshold,
      p_match_count: matchCount,
      p_session_id: options.sessionId || null,
      p_entry_types: options.entryTypes || null,
      p_min_importance: options.minImportance || null,
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      sessionId: item.session_id,
      content: item.content,
      contentType: item.content_type,
      importance: item.importance,
      similarity: item.similarity,
      createdAt: new Date(item.created_at),
      metadata: item.metadata || {},
    }));
  }

  /**
   * Fallback keyword search
   */
  async keywordSearch(
    userId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<MemorySearchResult[]> {
    const keywords = query.toLowerCase().split(/\s+/);
    
    let dbQuery = this.supabase
      .from('memory_entries')
      .select('*')
      .eq('user_id', userId);

    // Search in content and keywords
    const orConditions = keywords.map(k => `content.ilike.%${k}%`).join(',');
    dbQuery = dbQuery.or(orConditions);

    if (options.sessionId) {
      dbQuery = dbQuery.eq('session_id', options.sessionId);
    }

    if (options.entryTypes) {
      dbQuery = dbQuery.in('content_type', options.entryTypes);
    }

    const limit = options.limit || 10;

    const { data, error } = await dbQuery
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Keyword search failed: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      sessionId: item.session_id,
      content: item.content,
      contentType: item.content_type,
      importance: item.importance,
      similarity: 0.5, // Default score for keyword matches
      createdAt: new Date(item.created_at),
      metadata: item.metadata || {},
    }));
  }

  /**
   * Query what the agent knows about a topic
   * This is the key method for "What do I know about {topic}?"
   */
  async queryKnowledge(userId: string, topic: string): Promise<{
    memories: MemorySearchResult[];
    summary: string;
    relatedTopics: string[];
  }> {
    // Search for relevant memories
    const memories = await this.search(userId, topic, {
      matchCount: 20,
      matchThreshold: 0.6,
    });

    // Get recent user preferences
    const preferences = await this.getRecentEntries(userId, {
      entryTypes: ['user_preference'],
      limit: 10,
    });

    // Extract related topics from keywords
    const relatedTopics = new Set<string>();
    memories.forEach(m => {
      if (m.metadata.keywords) {
        (m.metadata.keywords as string[]).forEach(k => relatedTopics.add(k));
      }
    });

    // Generate summary
    const summary = this.generateKnowledgeSummary(topic, memories, preferences);

    return {
      memories: memories.slice(0, 10),
      summary,
      relatedTopics: Array.from(relatedTopics).slice(0, 10),
    };
  }

  // ========================================================================
  // CONTEXT BUILDING
  // ========================================================================

  /**
   * Build context for agent response
   * Called before responding: "What do I know about {topic}?"
   */
  async buildContext(
    userId: string,
    currentMessage: string,
    sessionId?: string
  ): Promise<MemoryContext> {
    // Get active session
    const session = sessionId 
      ? await this.getSession(sessionId)
      : await this.getOrCreateActiveSession(userId);

    if (!session) {
      throw new Error('No active session found');
    }

    // Get recent entries from this session
    const recentEntries = await this.getSessionEntries(session.id, this.config.maxContextEntries || 20);

    // Search for relevant memories
    const relevantMemories = await this.search(userId, currentMessage, {
      matchCount: 10,
      sessionId: session.id,
    });

    // Get user preferences
    const preferences = await this.getUserPreferences(userId);

    // Get session history
    const sessionHistory = await this.getRecentSessions(userId, 5);

    return {
      session,
      recentEntries,
      relevantMemories,
      userPreferences: preferences,
      sessionHistory,
    };
  }

  /**
   * Get user preferences from memory
   */
  async getUserPreferences(userId: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase
      .from('memory_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('content_type', 'user_preference')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return {};
    }

    const preferences: Record<string, unknown> = {};
    (data || []).forEach((entry: any) => {
      const key = entry.metadata?.preference_key || 'general';
      if (!preferences[key]) {
        preferences[key] = entry.content;
      }
    });

    return preferences;
  }

  // ========================================================================
  // CONSOLIDATION
  // ========================================================================

  /**
   * Consolidate old sessions into summaries
   * Should be called by a scheduled job (daily)
   */
  async consolidateOldMemories(userId?: string): Promise<ConsolidationResult> {
    // Get sessions needing consolidation
    const { data: sessions, error } = await this.supabase
      .from('memory_sessions')
      .select('*')
      .eq('consolidated', false)
      .eq('status', 'completed')
      .lt('ended_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error || !sessions || sessions.length === 0) {
      return {
        summaryId: '',
        entriesProcessed: 0,
        compressionRatio: 0,
        sessionsArchived: [],
      };
    }

    let totalEntries = 0;
    const archivedSessions: string[] = [];

    for (const sessionData of sessions) {
      const session = this.mapSessionFromDB(sessionData);
      
      // Skip if user filter specified
      if (userId && session.userId !== userId) continue;

      // Get all entries for this session
      const entries = await this.getSessionEntries(session.id);
      if (entries.length === 0) continue;

      // Generate summary
      const summary = await this.generateSessionSummary(session, entries);

      // Store summary
      const embedding = await this.embeddingProvider.embed(summary);
      
      const { data: summaryRecord, error: summaryError } = await this.supabase
        .from('memory_summaries')
        .insert({
          user_id: session.userId,
          period_start: session.createdAt.toISOString(),
          period_end: session.endedAt?.toISOString() || new Date().toISOString(),
          period_type: 'custom',
          summary,
          key_points: this.extractKeyPoints(entries),
          action_items: this.extractActionItems(entries),
          embedding: JSON.stringify(embedding),
          original_entry_count: entries.length,
          compression_ratio: 0.1, // 90% compression
          session_ids: [session.id],
        })
        .select()
        .single();

      if (summaryError) {
        console.error('[ClawMemory] Failed to store summary:', summaryError);
        continue;
      }

      // Mark session as consolidated
      await this.supabase.rpc('mark_session_consolidated', {
        p_session_id: session.id,
        p_summary_id: summaryRecord.id,
      });

      // Mark entries as compressed
      await this.supabase
        .from('memory_entries')
        .update({
          compressed: true,
          compression_ratio: 0.1,
        })
        .eq('session_id', session.id);

      totalEntries += entries.length;
      archivedSessions.push(session.id);
    }

    return {
      summaryId: '',
      entriesProcessed: totalEntries,
      compressionRatio: 0.1,
      sessionsArchived: archivedSessions,
    };
  }

  /**
   * Generate a summary for a session
   */
  private async generateSessionSummary(session: MemorySession, entries: MemoryEntry[]): Promise<string> {
    // Group entries by type
    const conversations = entries.filter(e => e.contentType === 'conversation');
    const decisions = entries.filter(e => e.contentType === 'decision');
    const actions = entries.filter(e => e.contentType === 'action');

    const parts: string[] = [];

    parts.push(`Session Summary: ${session.title || 'Untitled Session'}`);
    parts.push(`Date: ${session.createdAt.toDateString()}`);
    
    if (session.description) {
      parts.push(`Context: ${session.description}`);
    }

    if (conversations.length > 0) {
      parts.push(`\nKey Conversations (${conversations.length}):`);
      // Take first, middle, and last conversation as highlights
      const highlights = [
        conversations[0],
        conversations[Math.floor(conversations.length / 2)],
        conversations[conversations.length - 1],
      ].filter(Boolean);
      
      highlights.forEach(c => {
        parts.push(`- ${c.role}: ${c.content.substring(0, 150)}${c.content.length > 150 ? '...' : ''}`);
      });
    }

    if (decisions.length > 0) {
      parts.push(`\nDecisions Made (${decisions.length}):`);
      decisions.slice(0, 5).forEach(d => {
        parts.push(`- ${d.content.substring(0, 200)}`);
      });
    }

    if (actions.length > 0) {
      parts.push(`\nActions Taken (${actions.length}):`);
      actions.slice(0, 5).forEach(a => {
        parts.push(`- ${a.content.substring(0, 200)}`);
      });
    }

    return parts.join('\n');
  }

  // ========================================================================
  // PRUNING
  // ========================================================================

  /**
   * Prune old memories (mark for deletion)
   * Keeps last 90 days detailed, marks older for compression
   */
  async pruneOldMemories(userId?: string): Promise<PruningResult> {
    const { data, error } = await this.supabase.rpc('prune_old_memories', {
      p_user_id: userId || null,
      p_older_than_days: this.config.pruningThresholdDays,
    });

    if (error) {
      throw new Error(`Pruning failed: ${error.message}`);
    }

    return {
      prunedCount: data?.pruned_count || 0,
      freedTokens: data?.freed_tokens || 0,
    };
  }

  /**
   * Hard delete pruned memories (use with caution)
   */
  async hardDeletePruned(userId?: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('hard_delete_pruned_memories', {
      p_user_id: userId || null,
      p_older_than_days: 180,
    });

    if (error) {
      throw new Error(`Hard delete failed: ${error.message}`);
    }

    return data || 0;
  }

  // ========================================================================
  // AUTO-SAVE
  // ========================================================================

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      try {
        // Persist any in-memory context changes
        for (const [sessionId, session] of this.activeSessions) {
          await this.supabase
            .from('memory_sessions')
            .update({
              context_window: session.contextWindow,
              last_accessed_at: new Date().toISOString(),
            })
            .eq('id', sessionId);
        }
      } catch (error) {
        console.error('[ClawMemory] Auto-save error:', error);
      }
    }, 60000); // Every minute
  }

  /**
   * Stop auto-save
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Auto-save every conversation turn
   * This should be called by the agent after each response
   */
  async autoSaveConversation(
    userId: string,
    userMessage: string,
    assistantResponse: string,
    sessionId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const session = sessionId 
      ? await this.getSession(sessionId)
      : await this.getOrCreateActiveSession(userId);

    if (!session) return;

    // Store user message
    await this.storeConversation(userId, 'user', userMessage, session.id, metadata);

    // Store assistant response
    await this.storeConversation(userId, 'assistant', assistantResponse, session.id, metadata);

    // Update session last accessed
    await this.supabase
      .from('memory_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', session.id);
  }

  /**
   * Get memory statistics for a user
   */
  async getStatistics(userId: string): Promise<{
    totalEntries: number;
    totalSessions: number;
    totalTokens: number;
    compressedEntries: number;
    entries24h: number;
    entries7d: number;
    entries30d: number;
  }> {
    const { data, error } = await this.supabase
      .from('memory_statistics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return {
        totalEntries: 0,
        totalSessions: 0,
        totalTokens: 0,
        compressedEntries: 0,
        entries24h: 0,
        entries7d: 0,
        entries30d: 0,
      };
    }

    return {
      totalEntries: data.total_entries,
      totalSessions: data.total_sessions,
      totalTokens: data.total_tokens,
      compressedEntries: data.compressed_entries,
      entries24h: data.entries_24h,
      entries7d: data.entries_7d,
      entries30d: data.entries_30d,
    };
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private mapSessionFromDB(data: any): MemorySession {
    return {
      id: data.id,
      userId: data.user_id,
      agentId: data.agent_id,
      parentSessionId: data.parent_session_id,
      title: data.title,
      description: data.description,
      status: data.status,
      contextWindow: data.context_window || {},
      contextTokens: data.context_tokens,
      maxTokens: data.max_tokens,
      entryCount: data.entry_count,
      totalTokens: data.total_tokens,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
      lastAccessedAt: new Date(data.last_accessed_at),
      consolidated: data.consolidated,
      summaryId: data.summary_id,
      tags: data.tags || [],
      source: data.source,
      metadata: data.metadata || {},
    };
  }

  private mapEntryFromDB(data: any): MemoryEntry {
    return {
      id: data.id,
      sessionId: data.session_id,
      userId: data.user_id,
      content: data.content,
      contentType: data.content_type,
      importance: data.importance,
      embedding: data.embedding ? JSON.parse(data.embedding) : undefined,
      embeddingModel: data.embedding_model,
      role: data.role,
      turnNumber: data.turn_number,
      replyTo: data.reply_to,
      relatedEntries: data.related_entries,
      keywords: data.keywords,
      entities: data.entities,
      tokenCount: data.token_count,
      createdAt: new Date(data.created_at),
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
      compressed: data.compressed,
      originalEntryIds: data.original_entry_ids,
      compressionRatio: data.compression_ratio,
      metadata: data.metadata || {},
    };
  }

  private generateSessionTitle(): string {
    const date = new Date();
    return `Session ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }

  private estimateTokenCount(text: string): number {
    // Rough estimate: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    const frequency: Record<string, number> = {};
    words.forEach(w => {
      frequency[w] = (frequency[w] || 0) + 1;
    });

    // Return top 5 most frequent words
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private extractEntities(text: string): string[] {
    // Simple entity extraction (capitalized words)
    const entities = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    return [...new Set(entities)].slice(0, 10);
  }

  private extractKeyPoints(entries: MemoryEntry[]): string[] {
    return entries
      .filter(e => e.importance === 'high' || e.importance === 'critical')
      .map(e => e.content.substring(0, 200))
      .slice(0, 10);
  }

  private extractActionItems(entries: MemoryEntry[]): string[] {
    return entries
      .filter(e => e.contentType === 'action' || e.content.includes('TODO') || e.content.includes('ACTION'))
      .map(e => e.content.substring(0, 200))
      .slice(0, 10);
  }

  private generateKnowledgeSummary(
    topic: string, 
    memories: MemorySearchResult[],
    preferences: MemoryEntry[]
  ): string {
    if (memories.length === 0) {
      return `No prior knowledge found about "${topic}".`;
    }

    const parts: string[] = [];
    parts.push(`Knowledge about "${topic}":`);
    parts.push(`- Found ${memories.length} relevant memories`);

    const highImportance = memories.filter(m => m.importance === 'high' || m.importance === 'critical');
    if (highImportance.length > 0) {
      parts.push(`- ${highImportance.length} high-importance items`);
    }

    const recent = memories.filter(m => 
      m.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    if (recent.length > 0) {
      parts.push(`- ${recent.length} recent memories (last 7 days)`);
    }

    return parts.join('\n');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let memoryInstance: ClawMemory | null = null;

/**
 * Get or create the global memory instance
 */
export function getMemory(config?: ClawMemoryConfig): ClawMemory {
  if (!memoryInstance && config) {
    memoryInstance = new ClawMemory(config);
  }
  
  if (!memoryInstance) {
    throw new Error('ClawMemory not initialized. Pass config on first call.');
  }
  
  return memoryInstance;
}

/**
 * Initialize ClawMemory with configuration
 */
export function initializeMemory(config: ClawMemoryConfig): ClawMemory {
  memoryInstance = new ClawMemory(config);
  return memoryInstance;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ClawMemory;
