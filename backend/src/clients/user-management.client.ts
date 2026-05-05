import UserManagementV1 from '@ibm-cloud/platform-services/user-management/v1.js';
import { logger } from '../utils/logger';
import { AppError } from '../utils/error-handler';

/**
 * User profile information
 */
export interface UserProfile {
  readonly iamId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly state?: string;
  readonly accountId?: string;
}

/**
 * Client wrapper for IBM Cloud User Management API
 */
export class UserManagementClient {
  constructor(private readonly client: UserManagementV1) {}

  /**
   * Get user profile by IAM ID
   * @param accountId - IBM Cloud account ID
   * @param iamId - User's IAM ID (extracted from email or resource creator)
   * @returns User profile information
   */
  public async getUserProfile(accountId: string, iamId: string): Promise<UserProfile | null> {
    try {
      logger.debug({ accountId, iamId }, 'Fetching user profile');

      const params = {
        accountId,
        iamId,
      };

      const response = await this.client.getUserProfile(params);
      const user = response.result;

      if (!user) {
        logger.warn({ accountId, iamId }, 'User profile not found');
        return null;
      }

      return {
        iamId: user.iam_id || iamId,
        email: user.email || '',
        firstName: user.firstname || '',
        lastName: user.lastname || '',
        state: user.state,
        accountId: user.account_id,
      };
    } catch (error) {
      // Log but don't throw - we want to continue even if user profile fetch fails
      logger.warn({ accountId, iamId, error }, 'Failed to fetch user profile');
      return null;
    }
  }

  /**
   * Get multiple user profiles in batch
   * @param accountId - IBM Cloud account ID
   * @param iamIds - Array of IAM IDs
   * @returns Map of IAM ID to user profile
   */
  public async getUserProfiles(
    accountId: string,
    iamIds: string[],
  ): Promise<Map<string, UserProfile>> {
    const profiles = new Map<string, UserProfile>();

    // Fetch profiles in parallel with some concurrency control
    const batchSize = 5;
    for (let i = 0; i < iamIds.length; i += batchSize) {
      const batch = iamIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((iamId) => this.getUserProfile(accountId, iamId)),
      );

      results.forEach((result, index) => {
        const iamId = batch[index];
        if (result.status === 'fulfilled' && result.value && iamId) {
          profiles.set(iamId, result.value);
        }
      });
    }

    logger.info(
      { accountId, requested: iamIds.length, fetched: profiles.size },
      'Batch user profile fetch completed',
    );

    return profiles;
  }

  /**
   * Extract IAM ID from email address
   * IBM Cloud emails are typically in format: IBMid-<iamId>@<domain>
   * or the email itself can be used as IAM ID
   * @param email - User email address
   * @returns IAM ID or email
   */
  public static extractIamIdFromEmail(email: string): string {
    // Check if email contains IBMid- prefix
    const ibmIdMatch = email.match(/IBMid-([^@]+)/i);
    if (ibmIdMatch && ibmIdMatch[0]) {
      return ibmIdMatch[0];
    }

    // Otherwise use the email as IAM ID
    return email;
  }
}

// Made with Bob
