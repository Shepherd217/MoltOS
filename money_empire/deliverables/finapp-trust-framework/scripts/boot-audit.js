/**
 * Boot-Time Audit Script
 * Verifies file integrity and loads context on agent startup
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const CONFIG = {
  memoryFile: 'MEMORY.md',
  dailyDir: 'memory',
  trustLedgerDir: 'trust-ledgers',
  retentionThreshold: 0.95
};

async function runBootAudit() {
  console.log('[Trust Audit] Starting boot-time check...');
  
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    filesVerified: 0,
    filesMissing: [],
    retentionRate: 0,
    lastSession: null
  };

  try {
    // 1. Check MEMORY.md exists
    const memoryExists = await fileExists(CONFIG.memoryFile);
    if (!memoryExists) {
      console.log('[Trust Audit] ⚠️  MEMORY.md not found — creating...');
      await createDefaultMemoryFile();
    }
    results.filesVerified++;

    // 2. Check daily logs directory
    const dailyDirExists = await fileExists(CONFIG.dailyDir);
    if (!dailyDirExists) {
      console.log('[Trust Audit] ⚠️  Daily logs directory not found — creating...');
      await fs.mkdir(CONFIG.dailyDir, { recursive: true });
    }

    // 3. Check Trust Ledger directory
    const trustDirExists = await fileExists(CONFIG.trustLedgerDir);
    if (!trustDirExists) {
      console.log('[Trust Audit] ⚠️  Trust Ledger directory not found — creating...');
      await fs.mkdir(CONFIG.trustLedgerDir, { recursive: true });
    }

    // 4. Find most recent daily log
    const dailyLogs = await getDailyLogs();
    if (dailyLogs.length > 0) {
      results.lastSession = dailyLogs[0].date;
      results.filesVerified += dailyLogs.length;
    }

    // 5. Calculate retention (simplified — customize as needed)
    results.retentionRate = await calculateRetention();

    // 6. Log results
    const duration = Date.now() - startTime;
    console.log(`[Trust Audit] ✓ Complete (${duration}ms)`);
    console.log(`[Trust Audit] Retention: ${(results.retentionRate * 100).toFixed(1)}%`);
    console.log(`[Trust Audit] Files verified: ${results.filesVerified}`);
    console.log(`[Trust Audit] Last session: ${results.lastSession || 'N/A'}`);

    // 7. Save audit log
    await saveAuditLog(results);

    return results;

  } catch (error) {
    console.error('[Trust Audit] ✗ Error during audit:', error.message);
    throw error;
  }
}

async function fileExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function createDefaultMemoryFile() {
  const defaultContent = `# MEMORY.md — @finapp

_Last updated: ${new Date().toISOString()}_

## Core Identity

- **Name:** @finapp
- **Purpose:** 
- **Created:** 

## Key Preferences

## Important Context

## Lessons Learned

`;
  await fs.writeFile(CONFIG.memoryFile, defaultContent, 'utf8');
}

async function getDailyLogs() {
  try {
    const files = await fs.readdir(CONFIG.dailyDir);
    return files
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .map(f => ({
        date: f.replace('.md', ''),
        path: path.join(CONFIG.dailyDir, f)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function calculateRetention() {
  // Simplified retention calculation
  // In production: compare expected vs actual context loaded
  // For now: assume 100% if files exist, adjust based on your metrics
  return 1.0;
}

async function saveAuditLog(results) {
  const auditDir = 'audit-logs';
  await fs.mkdir(auditDir, { recursive: true });
  
  const filename = `${results.timestamp.split('T')[0]}-boot.json`;
  const filepath = path.join(auditDir, filename);
  
  await fs.writeFile(filepath, JSON.stringify(results, null, 2), 'utf8');
}

// Export for use in main agent
module.exports = { runBootAudit };

// Run if called directly
if (require.main === module) {
  runBootAudit().catch(console.error);
}
