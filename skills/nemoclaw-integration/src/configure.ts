import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { RuntimeInfo } from './detect';

export interface ConfigOptions {
  runtime?: 'auto' | 'nemoclaw' | 'openclaw' | 'docker' | 'bare';
  configPath?: string;
}

export interface MoltOSConfig {
  version: string;
  runtime: {
    type: string;
    adapter: string;
    options: Record<string, any>;
  };
  identity: {
    clawIdEnabled: boolean;
    storage: string;
  };
  reputation: {
    tapEnabled: boolean;
    network: string;
  };
  justice: {
    arbitraEnabled: boolean;
    evidencePath: string;
  };
  storage: {
    type: string;
    path: string;
  };
  inference: {
    primary: string;
    fallback: string;
    routing: 'local-first' | 'cost-optimized' | 'latency-optimized';
  };
}

/**
 * Configure MoltOS for the detected runtime
 */
export async function configureMoltOS(options: ConfigOptions = {}): Promise<MoltOSConfig> {
  const configPath = options.configPath || join(homedir(), '.moltos', 'runtime.config.json');
  
  // Ensure config directory exists
  await mkdir(join(configPath, '..'), { recursive: true });
  
  // Detect or use specified runtime
  let runtimeType = options.runtime || 'auto';
  if (runtimeType === 'auto') {
    runtimeType = await detectBestRuntime();
  }
  
  // Generate config based on runtime
  const config = generateConfig(runtimeType);
  
  // Write config file
  await writeFile(configPath, JSON.stringify(config, null, 2));
  
  // Create necessary directories
  await createDirectories(config);
  
  return config;
}

async function detectBestRuntime(): Promise<string> {
  const { detectRuntime } = await import('./detect');
  const runtimes = await detectRuntime();
  
  if (runtimes.find(r => r.name === 'NemoClaw' && r.available)) {
    return 'nemoclaw';
  }
  if (runtimes.find(r => r.name === 'OpenClaw' && r.available)) {
    return 'openclaw';
  }
  if (runtimes.find(r => r.name === 'Docker' && r.available)) {
    return 'docker';
  }
  
  return 'bare';
}

function generateConfig(runtimeType: string): MoltOSConfig {
  const baseConfig: MoltOSConfig = {
    version: '1.0.0',
    runtime: {
      type: runtimeType,
      adapter: `${runtimeType}-adapter`,
      options: {}
    },
    identity: {
      clawIdEnabled: true,
      storage: join(homedir(), '.moltos', 'identity')
    },
    reputation: {
      tapEnabled: true,
      network: 'mainnet'
    },
    justice: {
      arbitraEnabled: true,
      evidencePath: join(homedir(), '.moltos', 'evidence')
    },
    storage: {
      type: 'clawfs',
      path: join(homedir(), '.moltos', 'storage')
    },
    inference: {
      primary: 'auto',
      fallback: 'cloud',
      routing: 'local-first'
    }
  };
  
  // Runtime-specific overrides
  switch (runtimeType) {
    case 'nemoclaw':
      baseConfig.runtime.options = {
        sandbox: {
          landlock: true,
          seccomp: true,
          networkNamespaces: true
        },
        inference: {
          nemotronEnabled: true,
          privacyRouter: true
        },
        evidence: {
          auditLogIntegration: true,
          automaticSubmission: true
        }
      };
      baseConfig.inference.primary = 'nemotron-local';
      break;
      
    case 'docker':
      baseConfig.runtime.options = {
        container: {
          network: 'bridge',
          volumes: ['clawfs:/data']
        }
      };
      break;
      
    case 'bare':
      baseConfig.runtime.options = {
        sandbox: false,
        warning: 'Running without sandbox - not recommended for production'
      };
      break;
  }
  
  return baseConfig;
}

async function createDirectories(config: MoltOSConfig): Promise<void> {
  const dirs = [
    config.identity.storage,
    config.storage.path,
    config.justice.evidencePath,
    join(homedir(), '.moltos', 'logs')
  ];
  
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Load existing MoltOS configuration
 */
export async function loadConfig(configPath?: string): Promise<MoltOSConfig | null> {
  const path = configPath || join(homedir(), '.moltos', 'runtime.config.json');
  
  if (!existsSync(path)) {
    return null;
  }
  
  const { readFile } = await import('fs/promises');
  const content = await readFile(path, 'utf8');
  return JSON.parse(content) as MoltOSConfig;
}
