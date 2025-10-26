/**
 * Smart Cache
 *
 * In-memory caching layer with:
 * - LRU eviction policy
 * - TTL support
 * - Automatic cleanup
 * - Cache statistics
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictions: number;
}

export class SmartCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttl: number;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(maxSize: number = 100, ttlMs: number = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;

    // Auto-cleanup every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Get item from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set item in cache
   */
  set(key: string, value: T): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now()
    });
  }

  /**
   * Check if key exists (without updating access stats)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.ttl) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
    }

    if (toDelete.length > 0) {
      console.log(`🧹 Cache cleanup: removed ${toDelete.length} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
      evictions: this.stats.evictions
    };
  }

  /**
   * Print cache statistics
   */
  printStats(): void {
    const stats = this.getStats();
    console.log("\n📊 Cache Statistics:");
    console.log(`   Hits: ${stats.hits}`);
    console.log(`   Misses: ${stats.misses}`);
    console.log(`   Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`   Size: ${stats.size}/${stats.maxSize}`);
    console.log(`   Evictions: ${stats.evictions}\n`);
  }

  /**
   * Get or set (fetch if not in cache)
   */
  async getOrSet(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }
}

// Global caches for common use cases
export const contentCache = new SmartCache<any>(200, 3600000); // 1 hour TTL
export const imageCache = new SmartCache<any>(100, 7200000); // 2 hour TTL
export const layoutCache = new SmartCache<any>(150, 1800000); // 30 min TTL
