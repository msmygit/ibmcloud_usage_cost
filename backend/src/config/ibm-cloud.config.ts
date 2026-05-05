import { environmentConfig } from './environment.config';
import type { IBMCloudConfig } from '../types/config.types';

/**
 * Returns the validated IBM Cloud configuration.
 */
export const getIBMCloudConfig = (): IBMCloudConfig => environmentConfig.ibmCloud;

export const ibmCloudConfig = getIBMCloudConfig();

// Made with Bob
