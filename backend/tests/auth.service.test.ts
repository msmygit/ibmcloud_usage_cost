import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/services/auth.service';

describe('AuthService', () => {
  it('deduplicates concurrent refresh operations', async () => {
    const service = new AuthService();
    const tokenManager = {
      getToken: vi.fn(async () => 'token-123'),
      tokenInfo: {
        accessToken: 'token-123',
        tokenType: 'Bearer',
        expireTime: Date.now() + 3600_000,
      },
    };

    (
      service as unknown as {
        authenticator: { tokenManager: typeof tokenManager };
      }
    ).authenticator = { tokenManager } as never;

    const [first, second] = await Promise.all([service.testAuthentication(), service.getValidToken()]);

    expect(first.accessToken).toBe('token-123');
    expect(second.accessToken).toBe('token-123');
    expect(tokenManager.getToken).toHaveBeenCalledTimes(1);
  });
});

// Made with Bob
