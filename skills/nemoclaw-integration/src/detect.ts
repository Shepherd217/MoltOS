import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface RuntimeInfo {
  name: string;
  available: boolean;
  version?: string;
  features?: string[];
  path?: string;
}

/**
 * Detect all available runtimes
 */
export async function detectRuntime(): Promise<RuntimeInfo[]> {
  const runtimes: RuntimeInfo[] = [];
  
  // Check NemoClaw
  const nemoclaw = await detectNemoClaw();
  runtimes.push(nemoclaw);
  
  // Check OpenClaw
  const openclaw = await detectOpenClaw();
  runtimes.push(openclaw);
  
  // Check Docker
  const docker = await detectDocker();
  runtimes.push(docker);
  
  // Check Kubernetes
  const k8s = await detectKubernetes();
  runtimes.push(k8s);
  
  return runtimes;
}

async function detectNemoClaw(): Promise<RuntimeInfo> {
  const info: RuntimeInfo = { name: 'NemoClaw', available: false };
  
  try {
    // Check for nemoclaw CLI
    const result = execSync('which nemoclaw', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (result.trim()) {
      info.available = true;
      info.path = result.trim();
      
      // Get version
      try {
        const version = execSync('nemoclaw --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        info.version = version.trim();
      } catch {
        info.version = 'unknown';
      }
      
      // Check features
      info.features = [];
      if (await checkLandlock()) info.features.push('landlock');
      if (await checkSeccomp()) info.features.push('seccomp');
      if (await checkNemotron()) info.features.push('nemotron');
    }
  } catch {
    // Not installed
  }
  
  return info;
}

async function detectOpenClaw(): Promise<RuntimeInfo> {
  const info: RuntimeInfo = { name: 'OpenClaw', available: false };
  
  try {
    const result = execSync('which openclaw', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (result.trim()) {
      info.available = true;
      info.path = result.trim();
      
      try {
        const version = execSync('openclaw --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        info.version = version.trim();
      } catch {
        info.version = 'unknown';
      }
    }
  } catch {
    // Check for config file as fallback
    const configPath = join(homedir(), '.openclaw', 'config.json');
    if (existsSync(configPath)) {
      info.available = true;
      info.version = 'unknown';
    }
  }
  
  return info;
}

async function detectDocker(): Promise<RuntimeInfo> {
  const info: RuntimeInfo = { name: 'Docker', available: false };
  
  try {
    const result = execSync('docker --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (result.includes('Docker version')) {
      info.available = true;
      const match = result.match(/Docker version ([\d.]+)/);
      info.version = match?.[1] || 'unknown';
    }
  } catch {
    // Not installed
  }
  
  return info;
}

async function detectKubernetes(): Promise<RuntimeInfo> {
  const info: RuntimeInfo = { name: 'Kubernetes', available: false };
  
  try {
    const result = execSync('kubectl version --client --short', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (result.includes('Client Version')) {
      info.available = true;
      const match = result.match(/Client Version: v?([\d.]+)/);
      info.version = match?.[1] || 'unknown';
    }
  } catch {
    // Not installed
  }
  
  return info;
}

async function checkLandlock(): Promise<boolean> {
  try {
    // Check if kernel supports Landlock
    execSync('grep CONFIG_SECURITY_LANDLOCK /boot/config-$(uname -r)', { stdio: ['pipe', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

async function checkSeccomp(): Promise<boolean> {
  try {
    // Check if seccomp is available
    execSync('grep CONFIG_SECCOMP /boot/config-$(uname -r)', { stdio: ['pipe', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

async function checkNemotron(): Promise<boolean> {
  try {
    // Check for Nemotron model files
    const modelPath = join(homedir(), '.nemoclaw', 'models');
    return existsSync(modelPath);
  } catch {
    return false;
  }
}

/**
 * Get the best available runtime
 */
export async function getBestRuntime(): Promise<RuntimeInfo | null> {
  const runtimes = await detectRuntime();
  
  // Priority: NemoClaw > OpenClaw > Docker > Kubernetes
  const priority = ['NemoClaw', 'OpenClaw', 'Docker', 'Kubernetes'];
  
  for (const name of priority) {
    const runtime = runtimes.find(r => r.name === name && r.available);
    if (runtime) return runtime;
  }
  
  return null;
}
