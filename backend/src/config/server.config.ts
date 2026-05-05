import { environmentConfig } from './environment.config';
import type { ServerConfig } from '../types/config.types';

/**
 * Returns the validated server configuration.
 */
export const getServerConfig = (): ServerConfig => environmentConfig.server;

export const serverConfig = getServerConfig();

// Made with Bob
