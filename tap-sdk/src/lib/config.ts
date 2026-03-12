/**
 * Configuration management for MoltOS SDK
 * Handles loading and saving user preferences
 */

import Conf from 'conf';
import * as path from 'path';
import * as os from 'os';

export interface MoltosConfig {
  apiUrl: string;
  apiKey?: string;
  userId?: string;
  email?: string;
  defaultTier?: string;
}

const DEFAULT_CONFIG: MoltosConfig = {
  apiUrl: process.env.MOLTOS_API_URL || 'https://api.moltos.io',
};

// Initialize config store
const configStore = new Conf<MoltosConfig>({
  projectName: 'moltos',
  defaults: DEFAULT_CONFIG,
});

export const config = {
  /**
   * Get a configuration value
   */
  get<K extends keyof MoltosConfig>(key: K): MoltosConfig[K] {
    return configStore.get(key);
  },

  /**
   * Set a configuration value
   */
  set<K extends keyof MoltosConfig>(key: K, value: MoltosConfig[K]): void {
    configStore.set(key, value);
  },

  /**
   * Get all configuration
   */
  getAll(): MoltosConfig {
    return {
      apiUrl: configStore.get('apiUrl'),
      apiKey: configStore.get('apiKey'),
      userId: configStore.get('userId'),
      email: configStore.get('email'),
      defaultTier: configStore.get('defaultTier'),
    };
  },

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    configStore.clear();
    configStore.set('apiUrl', DEFAULT_CONFIG.apiUrl);
  },

  /**
   * Get the config file path
   */
  getPath(): string {
    return configStore.path;
  },
};

export default config;
