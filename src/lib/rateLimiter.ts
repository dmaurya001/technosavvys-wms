/**
 * IN-MEMORY SLIDING WINDOW RATE LIMITER
 * Protects OTP endpoints and certificate downloads from abuse, brute force, and scraping.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

class MemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically prune stale entries every 5 minutes to avoid memory leaks
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of this.store.entries()) {
          if (record.resetAt <= now) {
            this.store.delete(key);
          }
        }
      }, 5 * 60 * 1000);
      
      // Unref interval in Node environments so it doesn't prevent graceful shutdown
      if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Check and increment the hit count for a given identifier.
   * @param key Unique key (e.g. `otp:ip:phone`)
   * @param limit Max allowed attempts in the window
   * @param windowSec Window duration in seconds
   */
  public check(
    key: string,
    limit: number,
    windowSec: number
  ): {
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
    message?: string;
  } {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const record = this.store.get(key);

    if (!record || record.resetAt <= now) {
      // First hit or window expired
      this.store.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return {
        allowed: true,
        remaining: limit - 1,
        resetInSeconds: windowSec,
      };
    }

    if (record.count >= limit) {
      const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds,
        message: `Too many requests. Please wait ${resetInSeconds} seconds before retrying.`,
      };
    }

    record.count += 1;
    const resetInSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: true,
      remaining: Math.max(0, limit - record.count),
      resetInSeconds,
    };
  }

  /**
   * Reset rate limit for a key (e.g. on successful OTP verification)
   */
  public reset(key: string): void {
    this.store.delete(key);
  }
}

// Global singleton instance across Next.js API route invocations
const globalForLimiter = globalThis as unknown as {
  technosavvysRateLimiter?: MemoryRateLimiter;
};

export const rateLimiter =
  globalForLimiter.technosavvysRateLimiter ?? new MemoryRateLimiter();

if (process.env.NODE_ENV !== 'production') {
  globalForLimiter.technosavvysRateLimiter = rateLimiter;
}

