/**
 * Cache statistics for monitoring performance
 */
export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly sets: number;
  readonly deletes: number;
  readonly hitRate: number; // percentage
  readonly totalRequests: number;
}

/**
 * Detailed cache statistics with timing information
 */
export interface DetailedCacheStats extends CacheStats {
  readonly avgGetTimeMs: number;
  readonly avgSetTimeMs: number;
  readonly l1Stats: CacheLayerStats;
  readonly l2Stats: CacheLayerStats;
}

/**
 * Statistics for a specific cache layer
 */
export interface CacheLayerStats {
  readonly hits: number;
  readonly misses: number;
  readonly sets: number;
  readonly deletes: number;
  readonly hitRate: number;
  readonly size: number; // number of keys
  readonly sizeBytes?: number; // approximate size in bytes
}

/**
 * Cache statistics tracker
 */
export class CacheStatsTracker {
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;
  private getTimes: number[] = [];
  private setTimes: number[] = [];

  private l1Hits = 0;
  private l1Misses = 0;
  private l1Sets = 0;
  private l1Deletes = 0;

  private l2Hits = 0;
  private l2Misses = 0;
  private l2Sets = 0;
  private l2Deletes = 0;

  /**
   * Records a cache hit
   * @param layer - Cache layer (1 or 2)
   */
  public recordHit(layer: 1 | 2 = 1): void {
    this.hits++;
    if (layer === 1) {
      this.l1Hits++;
    } else {
      this.l2Hits++;
    }
  }

  /**
   * Records a cache miss
   * @param layer - Cache layer (1 or 2)
   */
  public recordMiss(layer: 1 | 2 = 1): void {
    this.misses++;
    if (layer === 1) {
      this.l1Misses++;
    } else {
      this.l2Misses++;
    }
  }

  /**
   * Records a cache set operation
   * @param layer - Cache layer (1 or 2)
   */
  public recordSet(layer: 1 | 2 = 1): void {
    this.sets++;
    if (layer === 1) {
      this.l1Sets++;
    } else {
      this.l2Sets++;
    }
  }

  /**
   * Records a cache delete operation
   * @param layer - Cache layer (1 or 2)
   */
  public recordDelete(layer: 1 | 2 = 1): void {
    this.deletes++;
    if (layer === 1) {
      this.l1Deletes++;
    } else {
      this.l2Deletes++;
    }
  }

  /**
   * Records a get operation timing
   * @param timeMs - Time taken in milliseconds
   */
  public recordGetTime(timeMs: number): void {
    this.getTimes.push(timeMs);
    // Keep only last 1000 timings
    if (this.getTimes.length > 1000) {
      this.getTimes.shift();
    }
  }

  /**
   * Records a set operation timing
   * @param timeMs - Time taken in milliseconds
   */
  public recordSetTime(timeMs: number): void {
    this.setTimes.push(timeMs);
    // Keep only last 1000 timings
    if (this.setTimes.length > 1000) {
      this.setTimes.shift();
    }
  }

  /**
   * Gets current cache statistics
   * @returns Cache statistics
   */
  public getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      hitRate,
      totalRequests,
    };
  }

  /**
   * Gets detailed cache statistics with timing and layer info
   * @param l1Size - Current L1 cache size
   * @param l2Size - Current L2 cache size
   * @returns Detailed cache statistics
   */
  public getDetailedStats(l1Size: number = 0, l2Size: number = 0): DetailedCacheStats {
    const stats = this.getStats();

    const avgGetTimeMs = this.calculateAverage(this.getTimes);
    const avgSetTimeMs = this.calculateAverage(this.setTimes);

    const l1TotalRequests = this.l1Hits + this.l1Misses;
    const l1HitRate = l1TotalRequests > 0 ? (this.l1Hits / l1TotalRequests) * 100 : 0;

    const l2TotalRequests = this.l2Hits + this.l2Misses;
    const l2HitRate = l2TotalRequests > 0 ? (this.l2Hits / l2TotalRequests) * 100 : 0;

    return {
      ...stats,
      avgGetTimeMs,
      avgSetTimeMs,
      l1Stats: {
        hits: this.l1Hits,
        misses: this.l1Misses,
        sets: this.l1Sets,
        deletes: this.l1Deletes,
        hitRate: l1HitRate,
        size: l1Size,
      },
      l2Stats: {
        hits: this.l2Hits,
        misses: this.l2Misses,
        sets: this.l2Sets,
        deletes: this.l2Deletes,
        hitRate: l2HitRate,
        size: l2Size,
      },
    };
  }

  /**
   * Resets all statistics
   */
  public reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.deletes = 0;
    this.getTimes = [];
    this.setTimes = [];

    this.l1Hits = 0;
    this.l1Misses = 0;
    this.l1Sets = 0;
    this.l1Deletes = 0;

    this.l2Hits = 0;
    this.l2Misses = 0;
    this.l2Sets = 0;
    this.l2Deletes = 0;
  }

  /**
   * Calculates average of an array of numbers
   * @param values - Array of numbers
   * @returns Average value
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Exports statistics as JSON
   * @returns JSON string of statistics
   */
  public toJSON(): string {
    return JSON.stringify(this.getStats(), null, 2);
  }

  /**
   * Gets a summary string of cache performance
   * @returns Summary string
   */
  public getSummary(): string {
    const stats = this.getStats();
    return `Cache Stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.hitRate.toFixed(2)}% hit rate`;
  }
}

// Made with Bob