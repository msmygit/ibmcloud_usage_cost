import { Request, Response } from 'express';
import { clientFactory } from '../../clients/client-factory';
import { logger } from '../../utils/logger';
import { ibmCloudConfig } from '../../config/ibm-cloud.config';
import type { ResourceGroup } from '../../types/ibm-cloud.types';

export class AccountsController {
  /**
   * Get list of accounts accessible with current API key
   */
  static async listAccounts(req: Request, res: Response) {
    try {
      // Check if API key is configured
      if (!ibmCloudConfig.apiKey) {
        logger.error('IBM Cloud API key not configured');
        return res.status(500).json({
          error: 'Configuration error',
          message: 'IBM_CLOUD_API_KEY is not configured. Please set it in your backend/.env file.'
        });
      }
      
      logger.info('Attempting to fetch accounts from IBM Cloud API');
      const client = clientFactory.createResourceControllerClient();
      
      // Verify client has the method
      if (typeof client.listResourceGroups !== 'function') {
        logger.error('Client does not have listResourceGroups method', {
          clientType: typeof client,
          clientMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(client))
        });
        throw new Error('Resource Controller client is not properly initialized');
      }
      
      // Fetch resource groups to determine accessible accounts
      logger.info('Calling listResourceGroups on client');
      const resourceGroups = await client.listResourceGroups();
      logger.info(`Received ${resourceGroups?.length || 0} resource groups`);
      
      if (!resourceGroups || resourceGroups.length === 0) {
        logger.warn('No resource groups found, checking for account ID in config');
        
        // If we have an account ID configured, return it
        if (ibmCloudConfig.accountId) {
          logger.info('No resource groups found, using configured account ID');
          return res.json({
            accounts: [{
              id: ibmCloudConfig.accountId,
              name: `Account ${ibmCloudConfig.accountId.substring(0, 8)}...`,
              resourceGroupCount: 0
            }],
            count: 1,
            source: 'environment',
            warning: 'No resource groups found via API. Using IBM_CLOUD_ACCOUNT_ID from configuration.'
          });
        }
        
        // No resource groups and no configured account ID
        logger.error('No resource groups found and no account ID configured');
        return res.status(404).json({
          error: 'No accounts found',
          message: 'No resource groups found for this API key. Please verify your API key has proper permissions or set IBM_CLOUD_ACCOUNT_ID in your .env file.'
        });
      }
      
      // Extract unique account IDs from resource groups
      const accountMap = new Map<string, { id: string; name: string; resourceGroupCount: number }>();
      resourceGroups.forEach((rg: ResourceGroup) => {
        if (rg.account_id && !accountMap.has(rg.account_id)) {
          accountMap.set(rg.account_id, {
            id: rg.account_id,
            name: rg.account_id,
            resourceGroupCount: 0
          });
        }
        if (rg.account_id) {
          const account = accountMap.get(rg.account_id);
          if (account) {
            account.resourceGroupCount++;
          }
        }
      });
      
      const accounts = Array.from(accountMap.values());
      
      logger.info(`Successfully found ${accounts.length} accessible account(s) via API`);
      
      res.json({
        accounts,
        count: accounts.length,
        source: 'api'
      });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      }, 'Error fetching accounts from IBM Cloud API');
      
      // Check if we have a configured account ID to fall back to
      if (ibmCloudConfig.accountId) {
        logger.info('API error occurred, falling back to configured account ID');
        return res.json({
          accounts: [{
            id: ibmCloudConfig.accountId,
            name: `Account ${ibmCloudConfig.accountId.substring(0, 8)}...`,
            resourceGroupCount: 0
          }],
          count: 1,
          source: 'environment',
          warning: `Could not fetch accounts from IBM Cloud API: ${error instanceof Error ? error.message : 'Unknown error'}. Using IBM_CLOUD_ACCOUNT_ID from configuration.`
        });
      }
      
      // No fallback available
      logger.error('No fallback account ID available');
      res.status(500).json({
        error: 'Failed to fetch accounts',
        message: error instanceof Error ? error.message : 'Unknown error occurred while fetching accounts',
        suggestion: 'Please verify your IBM_CLOUD_API_KEY has proper permissions or set IBM_CLOUD_ACCOUNT_ID in your .env file as a fallback.'
      });
    }
  }

  /**
   * Test IBM Cloud connection
   */
  static async testConnection(req: Request, res: Response) {
    try {
      const hasApiKey = !!ibmCloudConfig.apiKey;
      const apiKeyLength = ibmCloudConfig.apiKey?.length || 0;
      
      if (!hasApiKey) {
        return res.json({
          status: 'error',
          message: 'IBM Cloud API key not configured',
          hasApiKey: false
        });
      }
      
      // Try to create client
      const client = clientFactory.createResourceControllerClient();
      
      // Try to fetch resource groups
      const resourceGroups = await client.listResourceGroups();
      
      res.json({
        status: 'success',
        message: 'Successfully connected to IBM Cloud',
        hasApiKey: true,
        apiKeyLength,
        resourceGroupCount: resourceGroups.length
      });
    } catch (error) {
      logger.error('Connection test failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        hasApiKey: !!ibmCloudConfig.apiKey
      });
    }
  }
}

// Made with Bob
