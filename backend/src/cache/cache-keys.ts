import crypto from 'crypto';

/**
 * Cache key prefixes for different data types
 */
export const CachePrefix = {
  RESOURCES: 'resources',
  USAGE: 'usage',
  CORRELATION: 'correlation',
  ACCOUNT: 'account',
  REPORT: 'report',
} as const;

/**
 * Cache key generator for consistent key creation
 */
export class CacheKeyGenerator {
  /**
   * Generates a cache key for resources
   * @param accountId - IBM Cloud account ID
   * @param resourceGroupId - Optional resource group ID
   * @returns Cache key
   */
  public static forResources(accountId: string, resourceGroupId?: string): string {
    const parts = [CachePrefix.RESOURCES, accountId];
    if (resourceGroupId) {
      parts.push(resourceGroupId);
    }
    return parts.join(':');
  }

  /**
   * Generates a cache key for usage data
   * @param accountId - IBM Cloud account ID
   * @param month - Billing month in YYYY-MM format
   * @returns Cache key
   */
  public static forUsage(accountId: string, month: string): string {
    return `${CachePrefix.USAGE}:${accountId}:${month}`;
  }

  /**
   * Generates a cache key for usage range
   * @param accountId - IBM Cloud account ID
   * @param startMonth - Start month in YYYY-MM format
   * @param endMonth - End month in YYYY-MM format
   * @returns Cache key
   */
  public static forUsageRange(accountId: string, startMonth: string, endMonth: string): string {
    return `${CachePrefix.USAGE}:${accountId}:${startMonth}:${endMonth}`;
  }

  /**
   * Generates a cache key for correlated data
   * @param accountId - IBM Cloud account ID
   * @param month - Billing month in YYYY-MM format
   * @param options - Correlation options hash
   * @returns Cache key
   */
  public static forCorrelation(
    accountId: string,
    month: string,
    options?: Record<string, unknown>,
  ): string {
    const parts = [CachePrefix.CORRELATION, accountId, month];
    if (options && Object.keys(options).length > 0) {
      const optionsHash = this.hashObject(options);
      parts.push(optionsHash);
    }
    return parts.join(':');
  }

  /**
   * Generates a cache key for account summary
   * @param accountId - IBM Cloud account ID
   * @returns Cache key
   */
  public static forAccount(accountId: string): string {
    return `${CachePrefix.ACCOUNT}:${accountId}`;
  }

  /**
   * Generates a cache key for a report
   * @param accountId - IBM Cloud account ID
   * @param reportType - Type of report
   * @param params - Report parameters
   * @returns Cache key
   */
  public static forReport(
    accountId: string,
    reportType: string,
    params: Record<string, unknown>,
  ): string {
    const paramsHash = this.hashObject(params);
    return `${CachePrefix.REPORT}:${accountId}:${reportType}:${paramsHash}`;
  }

  /**
   * Generates a pattern for cache key matching
   * @param prefix - Cache prefix
   * @param accountId - Optional account ID
   * @returns Pattern string for matching
   */
  public static pattern(prefix: string, accountId?: string): string {
    if (accountId) {
      return `${prefix}:${accountId}:*`;
    }
    return `${prefix}:*`;
  }

  /**
   * Parses a cache key into its components
   * @param key - Cache key
   * @returns Parsed components
   */
  public static parse(key: string): {
    prefix: string;
    accountId?: string;
    parts: string[];
  } {
    const parts = key.split(':');
    const prefix = parts[0] || '';
    const accountId = parts[1];

    return {
      prefix,
      accountId,
      parts: parts.slice(2),
    };
  }

  /**
   * Creates a hash of an object for use in cache keys
   * @param obj - Object to hash
   * @returns Hash string
   */
  private static hashObject(obj: Record<string, unknown>): string {
    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      sortedObj[key] = obj[key];
    }

    const str = JSON.stringify(sortedObj);
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  /**
   * Validates a cache key format
   * @param key - Cache key to validate
   * @returns True if valid
   */
  public static isValid(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    const parts = key.split(':');
    if (parts.length < 2) {
      return false;
    }

    const validPrefixes = Object.values(CachePrefix);
    return validPrefixes.includes(parts[0] as (typeof CachePrefix)[keyof typeof CachePrefix]);
  }

  /**
   * Extracts account ID from a cache key
   * @param key - Cache key
   * @returns Account ID or undefined
   */
  public static extractAccountId(key: string): string | undefined {
    const parsed = this.parse(key);
    return parsed.accountId;
  }
}

// Made with Bob