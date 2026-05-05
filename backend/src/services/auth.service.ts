import { IamAuthenticator } from 'ibm-cloud-sdk-core';

import { ibmCloudConfig } from '../config/ibm-cloud.config';
import type { IBMCloudToken } from '../types/ibm-cloud.types';
import { AuthenticationError } from '../utils/error-handler';
import { logger } from '../utils/logger';

interface TokenSnapshot {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly tokenType: string;
  readonly expireTime: number;
}

export class AuthService {
  private readonly authenticator: IamAuthenticator;

  private readonly tokenRefreshBufferMs: number;

  private refreshPromise: Promise<IBMCloudToken> | null = null;

  public constructor() {
    this.authenticator = new IamAuthenticator({
      apikey: ibmCloudConfig.apiKey,
      url: ibmCloudConfig.iamUrl,
    });
    this.tokenRefreshBufferMs = ibmCloudConfig.tokenRefreshBufferMs;
  }

  /**
   * Returns the shared IAM authenticator instance.
   */
  public getAuthenticator(): IamAuthenticator {
    return this.authenticator;
  }

  /**
   * Tests whether authentication succeeds with the configured API key.
   */
  public async testAuthentication(): Promise<IBMCloudToken> {
    return this.refreshToken(true);
  }

  /**
   * Gets a valid token and refreshes it before expiration.
   */
  public async getValidToken(): Promise<IBMCloudToken> {
    const currentToken = this.getCurrentTokenSnapshot();

    if (currentToken && Date.now() + this.tokenRefreshBufferMs < currentToken.expireTime) {
      return this.mapToken(currentToken);
    }

    return this.refreshToken();
  }

  /**
   * Returns whether the current token is close to expiration.
   */
  public isTokenExpiringSoon(): boolean {
    const currentToken = this.getCurrentTokenSnapshot();

    if (!currentToken) {
      return true;
    }

    return Date.now() + this.tokenRefreshBufferMs >= currentToken.expireTime;
  }

  private async refreshToken(force = false): Promise<IBMCloudToken> {
    if (this.refreshPromise && !force) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.fetchAndCacheToken();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async fetchAndCacheToken(): Promise<IBMCloudToken> {
    try {
      const accessToken = await (
        this.authenticator as unknown as {
          tokenManager: { getToken(): Promise<string> };
        }
      ).tokenManager.getToken();
      const token = this.mapToken(
        this.getCurrentTokenSnapshot(accessToken) ?? {
          accessToken,
          tokenType: 'Bearer',
          expireTime: Date.now() + 60 * 60 * 1000,
        },
      );

      logger.info(
        {
          operation: 'auth.refreshToken',
          expiresAt: token.expiresAt.toISOString(),
        },
        'IBM Cloud IAM token refreshed',
      );

      return token;
    } catch (error) {
      throw new AuthenticationError('IBM Cloud authentication failed', {
        operation: 'auth.refreshToken',
        service: 'iam',
        cause: error,
      });
    }
  }

  private getCurrentTokenSnapshot(accessTokenOverride?: string): TokenSnapshot | null {
    const tokenManager = this.authenticator as unknown as {
      tokenManager?: {
        tokenInfo?: {
          accessToken?: string;
          refreshToken?: string;
          tokenType?: string;
          expireTime?: number;
        };
      };
    };

    const tokenInfo = tokenManager.tokenManager?.tokenInfo;

    if (!tokenInfo?.expireTime) {
      return accessTokenOverride
        ? {
            accessToken: accessTokenOverride,
            tokenType: 'Bearer',
            expireTime: Date.now() + 60 * 60 * 1000,
          }
        : null;
    }

    return {
      accessToken: accessTokenOverride ?? tokenInfo.accessToken ?? '',
      refreshToken: tokenInfo.refreshToken,
      tokenType: tokenInfo.tokenType ?? 'Bearer',
      expireTime: tokenInfo.expireTime,
    };
  }

  private mapToken(token: TokenSnapshot): IBMCloudToken {
    if (!token.accessToken || !token.expireTime) {
      throw new AuthenticationError('IBM Cloud IAM token unavailable', {
        operation: 'auth.mapToken',
        service: 'iam',
      });
    }

    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      expiration: token.expireTime,
      expiresAt: new Date(token.expireTime),
    };
  }
}

export const authService = new AuthService();

// Made with Bob
