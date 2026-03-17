#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { detectRuntime, type RuntimeInfo } from './detect';
import { installNemoClaw } from './install';
import { configureMoltOS } from './configure';
import { NemoClawAdapter } from './adapter';

const program = new Command();

program
  .name('nemoclaw-integration')
  .description('NemoClaw runtime integration for MoltOS')
  .version('1.0.0');

program
  .command('detect')
  .description('Detect available runtimes')
  .action(async () => {
    console.log(chalk.blue('🔍 Detecting runtimes...\n'));
    
    const runtimes = await detectRuntime();
    
    for (const runtime of runtimes) {
      const status = runtime.available 
        ? chalk.green('✓ Available') 
        : chalk.red('✗ Not found');
      console.log(`${chalk.bold(runtime.name)}: ${status}`);
      if (runtime.version) {
        console.log(`  Version: ${runtime.version}`);
      }
      if (runtime.features?.length) {
        console.log(`  Features: ${runtime.features.join(', ')}`);
      }
      console.log();
    }
  });

program
  .command('install')
  .description('Install NemoClaw and configure MoltOS')
  .option('--skip-nemoclaw', 'Skip NemoClaw installation')
  .option('--runtime <type>', 'Force specific runtime', 'auto')
  .action(async (options) => {
    console.log(chalk.cyan('🦞 MoltOS + NemoClaw Integration\n'));
    
    // Step 1: Detect or install NemoClaw
    if (!options.skipNemoclaw) {
      const spinner = ora('Checking NemoClaw installation').start();
      const runtimes = await detectRuntime();
      const nemoclaw = runtimes.find(r => r.name === 'NemoClaw');
      
      if (nemoclaw?.available) {
        spinner.succeed(`NemoClaw found (${nemoclaw.version})`);
      } else {
        spinner.info('NemoClaw not found, installing...');
        try {
          await installNemoClaw();
          spinner.succeed('NemoClaw installed successfully');
        } catch (error) {
          spinner.fail(`Installation failed: ${error}`);
          process.exit(1);
        }
      }
    }
    
    // Step 2: Configure MoltOS
    const configSpinner = ora('Configuring MoltOS for NemoClaw').start();
    try {
      await configureMoltOS({ runtime: options.runtime });
      configSpinner.succeed('MoltOS configured');
    } catch (error) {
      configSpinner.fail(`Configuration failed: ${error}`);
      process.exit(1);
    }
    
    // Step 3: Verify integration
    const verifySpinner = ora('Verifying integration').start();
    try {
      const adapter = new NemoClawAdapter();
      await adapter.initialize();
      const health = await adapter.healthCheck();
      
      if (health.healthy) {
        verifySpinner.succeed('Integration verified');
        console.log(chalk.green('\n✨ MoltOS is ready on NemoClaw!'));
        console.log(chalk.dim('\nNext steps:'));
        console.log(chalk.dim('  1. Register your ClawID: npx @moltos/sdk register'));
        console.log(chalk.dim('  2. Join the TAP network: npx @moltos/sdk tap join'));
        console.log(chalk.dim('  3. Start building: npx @moltos/sdk agent create'));
      } else {
        verifySpinner.warn('Integration incomplete');
        console.log(chalk.yellow('\n⚠️  Issues detected:'));
        health.issues?.forEach(issue => console.log(`  - ${issue}`));
      }
    } catch (error) {
      verifySpinner.fail(`Verification failed: ${error}`);
    }
  });

program
  .command('adapter <action>')
  .description('Control NemoClaw adapter (start|stop|status)')
  .action(async (action) => {
    const adapter = new NemoClawAdapter();
    
    switch (action) {
      case 'start':
        await adapter.initialize();
        console.log(chalk.green('✓ NemoClaw adapter started'));
        break;
      case 'stop':
        await adapter.shutdown();
        console.log(chalk.green('✓ NemoClaw adapter stopped'));
        break;
      case 'status':
        const health = await adapter.healthCheck();
        console.log(chalk.blue('Adapter Status:'));
        console.log(`  Healthy: ${health.healthy ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  Runtime: ${health.runtime || 'Unknown'}`);
        if (health.issues?.length) {
          console.log(chalk.yellow('  Issues:'));
          health.issues.forEach(i => console.log(`    - ${i}`));
        }
        break;
      default:
        console.error(chalk.red(`Unknown action: ${action}`));
        process.exit(1);
    }
  });

program.parse();
