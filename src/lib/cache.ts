/**
 * In-memory Cache Layer for FUZE Atlas
 *
 * Provides a generic TTL-based cache with LRU eviction for performance optimization.
 *
 * PRODUCTION NOTE: For production deployments, upgrade to Upstash Redis:
 * - Distributed caching across multiple servers
 * - Persistent storage with automatic failover
 * - Better scalability and reliability
 * - npm install @upstash/redis
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessedAt: number;
}

interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of entries before LRU eviction
}

/**
 * Generic in-memory cache class with TTL and LRU eviction
 */
export class Cache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private ttl: number; // Default TTL in seconds
  private maxSize: number;

  constructor(config: CacheConfig) {
    this.ttl = config.ttl;
    this.maxSize = config.maxSize;
  }

  /**
   * Get a value from cache
   * Returns null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();
    return entry.value;
  }

  /**
   * Set a value in cache
   * Optionally specify a custom TTL for this entry
   */
  set(key: string, value: T, ttl?: number): void {
    const finalTtl = ttl ?? this.ttl;

    // Check if we need to evict entries (LRU)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + finalTtl * 1000,
      accessedAt: Date.now(),
    });
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * LRU (Least Recently Used) eviction
   * Removes the entry that hasn't been accessed for the longest time
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let oldestAccessTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt < oldestAccessTime) {
        oldestAccessTime = entry.accessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Clean up expired entries (can be called periodically)
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Pre-configured cache instances for common use cases
 */

// Dashboard stats cache (60 second TTL, max 50 entries)
export const dashboardCache = new Cache({
  ttl: 60,
  maxSize: 50,
});

// Search results cache (30 second TTL, max 100 entries)
export const searchCache = new Cache({
  ttl: 30,
  maxSize: 100,
});

// Exchange rates and currency conversion (1 hour TTL, max 10 entries)
export const exchangeRateCache = new Cache({
  ttl: 3600,
  maxSize: 10,
});

// Competitor analysis cache (5 minute TTL, max 50 entries)
export const competitorCache = new Cache({
  ttl: 300,
  maxSize: 50,
});

/**
 * Higher-order wrapper function for caching async fetcher functions
 *
 * Usage:
 * ```
 * const data = await withCache(
 *   'dashboard-stats-user-123',
 *   60,
 *   dashboardCache,
 *   async () => {
 *     return await fetchDashboardStats(userId);
 *   }
 * );
 * ```
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  cache: Cache<T>,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = cache.get(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache with specified TTL
  cache.set(key, data, ttl);

  return data;
}

/**
 * Batch cache wrapper for fetching multiple items with caching
 * Reduces database queries when fetching multiple related items
 */
export async function withBatchCache<T>(
  keys: string[],
  ttl: number,
  cache: Cache<T>,
  fetcher: (missingKeys: string[]) => Promise<Map<string, T>>
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const missingKeys: string[] = [];

  // Check which keys are already cached
  for (const key of keys) {
    const cached = cache.get(key);
    if (cached !== null) {
      results.set(key, cached);
    } else {
      missingKeys.push(key);
    }
  }

  // If there are missing keys, fetch them
  if (missingKeys.length > 0) {
    const freshData = await fetcher(missingKeys);

    // Cache and add to results
    for (const [key, value] of freshData.entries()) {
      cache.set(key, value, ttl);
      results.set(key, value);
    }
  }

  return results;
}

/**
 * Periodic cleanup interval (clears expired entries every 5 minutes)
 * Can be called at application startup
 */
export function startCacheCleanupInterval(): NodeJS.Timeout {
  return setInterval(() => {
    const removed1 = dashboardCache.cleanup();
    const removed2 = searchCache.cleanup();
    const removed3 = exchangeRateCache.cleanup();
    const removed4 = competitorCache.cleanup();

    if (removed1 + removed2 + removed3 + removed4 > 0) {
      console.log(
        `[Cache] Cleanup: removed ${removed1 + removed2 + removed3 + removed4} expired entries`
      );
    }
  }, 5 * 60 * 1000); // 5 minutes
}
