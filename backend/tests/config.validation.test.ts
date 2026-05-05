import { describe, expect, it } from 'vitest';

import {
  EnvironmentValidationError,
  parseEnvironment,
} from '../src/config/environment.config';

describe('parseEnvironment', () => {
  it('parses a valid environment payload', () => {
    const config = parseEnvironment({
      IBM_CLOUD_API_KEY: 'a'.repeat(44),
      IBM_CLOUD_RESOURCE_CONTROLLER_URL: 'https://resource-controller.cloud.ibm.com',
      IBM_CLOUD_USAGE_REPORTS_URL: 'https://billing.cloud.ibm.com',
    });

    expect(config.server.port).toBe(3000);
    expect(config.ibmCloud.apiKey).toHaveLength(44);
    expect(config.ibmCloud.retry.attempts).toBe(3);
  });

  it('throws on invalid environment payload', () => {
    expect(() =>
      parseEnvironment({
        IBM_CLOUD_API_KEY: 'short',
      }),
    ).toThrow(EnvironmentValidationError);
  });
});

// Made with Bob
