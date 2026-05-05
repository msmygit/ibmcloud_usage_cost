import UsageReportsV4 from '@ibm-cloud/platform-services/usage-reports/v4.js';

import type { ResourceUsageList, UsageAccountSummary } from '../types/ibm-cloud.types';
import type { UsageQueryOptions } from '../types/resource.types';
import { logger } from '../utils/logger';

export class UsageReportsClient {
  public constructor(private readonly client: UsageReportsV4) {}

  /**
   * Gets account usage for a billing month.
   * This includes resources array with billable_cost for each resource.
   */
  public async getAccountUsage(accountId: string, month: string): Promise<UsageAccountSummary> {
    try {
      logger.info('Fetching account usage', { accountId, month });
      
      const response = await this.client.getAccountUsage({
        accountId,
        billingmonth: month,
      });

      // The SDK returns AccountUsage which has resources array
      const result = response.result as any;
      
      // Log resources details for debugging
      console.log('=== ACCOUNT USAGE DEBUG ===');
      console.log('Month requested:', month);
      console.log('Account ID:', accountId);
      console.log('Has resources:', !!result.resources);
      console.log('resources length:', result.resources?.length || 0);
      console.log('Currency code:', result.currency_code);
      console.log('Pricing country:', result.pricing_country);
      
      if (result.resources && result.resources.length > 0) {
        console.log('=== FIRST RESOURCE SAMPLE ===');
        console.log(JSON.stringify(result.resources[0], null, 2));
        console.log('=== END SAMPLE ===');
      } else {
        console.log('⚠️  NO resources found in IBM Cloud response!');
        console.log('This means either:');
        console.log('  1. No billable usage for this month');
        console.log('  2. Current month billing not yet finalized (try previous month)');
        console.log('  3. Account has no active resources');
      }
      console.log('=== END DEBUG ===');
      
      logger.info('Account usage fetched', {
        accountId,
        month,
        resourceCount: result.resources?.length || 0,
      });

      return {
        account_id: result.account_id,
        month: result.month,
        billing_country_code: result.billing_country,
        billing_currency_code: result.currency_code,
        pricing_country: result.pricing_country,
        currency_code: result.currency_code,
        currency_rate: result.currency_rate,
        resources: result.resources || [],
      };
    } catch (error) {
      logger.error('Error fetching account summary', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        accountId,
        month,
      });
      throw error;
    }
  }

  /**
   * Gets resource usage with automatic pagination.
   * Note: IBM Cloud Usage Reports API doesn't accept offset parameter in the SDK.
   * We fetch all records in a single request with the maximum allowed limit.
   */
  public async getResourceUsage(
    accountId: string,
    month: string,
    options: UsageQueryOptions = {},
  ): Promise<ResourceUsageList['resources']> {
    const limit = options.limit ?? 200; // IBM Cloud max limit is 200

    const response = await this.client.getResourceUsageAccount({
      accountId,
      billingmonth: month,
      names: true,
      limit,
    });

    const result = response.result as any;
    const resources = result.resources || [];
    
    // Log sample to debug cost field mapping
    if (resources.length > 0) {
      logger.info('=== RESOURCE USAGE SAMPLE ===');
      logger.info(JSON.stringify(resources[0], null, 2));
      logger.info('=== END SAMPLE ===');
    }
    
    return resources;
  }
}

// Made with Bob
