import { describe, expect, it } from 'vitest';
import { UserManagementClient } from '../src/clients/user-management.client';

describe('UserManagementClient.extractIamIdFromEmail', () => {
  it('preserves full IBMid- prefix for IBMid emails', () => {
    const email = 'IBMid-668000V7H0@example.com';
    const result = UserManagementClient.extractIamIdFromEmail(email);
    expect(result).toBe('IBMid-668000V7H0');
  });

  it('handles case-insensitive IBMid prefix', () => {
    const email = 'ibmid-ABC123XYZ@example.com';
    const result = UserManagementClient.extractIamIdFromEmail(email);
    expect(result).toBe('ibmid-ABC123XYZ');
  });

  it('returns email as-is when no IBMid prefix present', () => {
    const email = 'user@example.com';
    const result = UserManagementClient.extractIamIdFromEmail(email);
    expect(result).toBe('user@example.com');
  });

  it('handles IBMid without domain', () => {
    const email = 'IBMid-668000V7H0';
    const result = UserManagementClient.extractIamIdFromEmail(email);
    expect(result).toBe('IBMid-668000V7H0');
  });
});

// Made with Bob