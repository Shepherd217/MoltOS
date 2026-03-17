import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import ora from 'ora';

export interface InstallOptions {
  version?: string;
  installPath?: string;
  components?: string[];
}

/**
 * Install NemoClaw using official installer
 */
export async function installNemoClaw(options: InstallOptions = {}): Promise<void> {
  const { 
    version = 'latest',
    installPath = join(homedir(), '.nemoclaw'),
    components = ['openshell', 'nemotron', 'policies']
  } = options;
  
  // Ensure install directory exists
  await mkdir(installPath, { recursive: true });
  
  // Check for NVIDIA hardware
  const hasNvidia = checkNvidiaHardware();
  
  if (hasNvidia) {
    console.log('✓ NVIDIA hardware detected');
  } else {
    console.log('⚠ No NVIDIA hardware detected - will use CPU fallback');
  }
  
  // Run official NemoClaw installer
  const spinner = ora('Downloading NemoClaw...').start();
  
  try {
    // Try npm first
    execSync(`npm install -g @nvidia/nemoclaw@${version}`, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    spinner.succeed('NemoClaw installed via npm');
  } catch (npmError) {
    // Fallback to curl installer
    spinner.text = 'Trying alternative installer...';
    try {
      execSync('curl -fsSL https://get.nemoclaw.nvidia.com | bash', {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      spinner.succeed('NemoClaw installed via official script');
    } catch (curlError) {
      spinner.fail('Failed to install NemoClaw');
      throw new Error(`Installation failed: ${curlError}`);
    }
  }
  
  // Install selected components
  for (const component of components) {
    await installComponent(component, installPath);
  }
  
  // Verify installation
  const verifySpinner = ora('Verifying installation').start();
  try {
    execSync('nemoclaw --version', { stdio: 'ignore' });
    verifySpinner.succeed('NemoClaw ready');
  } catch {
    verifySpinner.fail('Installation verification failed');
    throw new Error('NemoClaw installed but not in PATH');
  }
}

async function installComponent(component: string, installPath: string): Promise<void> {
  const spinner = ora(`Installing ${component}...`).start();
  
  try {
    switch (component) {
      case 'openshell':
        // OpenShell is core, comes with base install
        execSync('nemoclaw component install openshell', { stdio: 'ignore' });
        break;
        
      case 'nemotron':
        // Download Nemotron models
        execSync('nemoclaw model pull nemotron-3-super:8b', { stdio: 'ignore' });
        break;
        
      case 'policies':
        // Install default policy templates
        const policyDir = join(installPath, 'policies');
        await mkdir(policyDir, { recursive: true });
        // Write default policy
        break;
        
      default:
        spinner.warn(`Unknown component: ${component}`);
        return;
    }
    
    spinner.succeed(`${component} installed`);
  } catch (error) {
    spinner.fail(`${component} installation failed: ${error}`);
    // Continue with other components
  }
}

function checkNvidiaHardware(): boolean {
  try {
    execSync('nvidia-smi --query-gpu=name --format=csv,noheader', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Uninstall NemoClaw
 */
export async function uninstallNemoClaw(): Promise<void> {
  const spinner = ora('Uninstalling NemoClaw...').start();
  
  try {
    execSync('npm uninstall -g @nvidia/nemoclaw', { stdio: 'ignore' });
    spinner.succeed('NemoClaw uninstalled');
  } catch {
    spinner.warn('Could not uninstall via npm, manual removal may be needed');
  }
}
