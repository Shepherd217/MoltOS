/**
 * Rate Limiting Utilities
 * 
 * Implements rate limiting using Upstash Redis to prevent API abuse.
 * Different limits for different endpoint types.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

// Rate limit configurations
export const rateLimits = {
  // Strict: Authentication endpoints
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 per minute
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  // Standard: Most API endpoints
  standard: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 per minute
    analytics: true,
    prefix: 'ratelimit:standard',
  }),

  // Relaxed: Read-only endpoints
  read: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(300, '1 m'), // 300 per minute
    analytics: true,
    prefix: 'ratelimit:read',
  }),

  // Strict: Write operations that affect reputation
  critical: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 per minute
    analytics: true,
    prefix: 'ratelimit:critical',
  }),

  // Very strict: Genesis token usage
  genesis: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 per hour
    analytics: true,
    prefix: 'ratelimit:genesis',
  }),
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
  error?: string
}

/**
 * Check rate limit for a given identifier
 * 
 * @param type - Rate limit type
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @returns RateLimitResult
 */
export async function checkRateLimit(
  type: keyof typeof rateLimits,
  identifier: string
): Promise<RateLimitResult> {
  try {
    // Skip rate limiting if Redis not configured (development)
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      return {
        success: true,
        limit: 999999,
        remaining: 999999,
        reset: Date.now() + 60000,
      }
    }

    const limiter = rateLimits[type]
    const { success, limit, remaining, reset } = await limiter.limit(identifier)

    return {
      success,
      limit,
      remaining,
      reset,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // Fail open - allow request if rate limiter is down
    return {
      success: true,
      limit: 999999,
      remaining: 999999,
      reset: Date.now() + 60000,
    }
  }
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  // Try various headers
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback to a default (can't get IP in edge runtime without headers)
  return 'unknown'
}

/**
 * Create rate limit response headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  }
}
