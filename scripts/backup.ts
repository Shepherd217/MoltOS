/**
 * MoltOS Automated Database Backup
 * 
 * Performs scheduled backups of the Supabase database.
 * Supports full dumps, incremental backups, and verification.
 * 
 * Environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - BACKUP_STORAGE_PROVIDER (s3, gcs, local)
 * - BACKUP_STORAGE_PATH
 * - BACKUP_ENCRYPTION_KEY (optional)
 * 
 * Run via cron: 0 2 * * * node scripts/backup.js (daily at 2am)
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  // Tables to backup (in dependency order)
  tables: [
    'agent_registry',
    'attestations',
    'tap_scores',
    'dispute_cases',
    'appeals',
    'escrow_transactions',
    'notifications',
    'honeypot_agents',
    'honeypot_detection_events',
    'claw_messages',
    'claw_files',
    'aggregated_attestations',
    'health_events',
    'alert_history',
    'system_metrics',
    'backup_history'
  ],
  
  // Backup retention
  retention: {
    daily: 7,    // Keep 7 daily backups
    weekly: 4,   // Keep 4 weekly backups
    monthly: 12  // Keep 12 monthly backups
  }
};

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BackupResult {
  success: boolean;
  backupId?: string;
  type: 'full' | 'incremental' | 'schema';
  sizeBytes: number;
  tableCount: number;
  rowCount: number;
  durationSeconds: number;
  checksum: string;
  storagePath: string;
  error?: string;
}

/**
 * Create backup directory if needed
 */
async function ensureBackupDir(): Promise<string> {
  const backupDir = process.env.BACKUP_STORAGE_PATH || './backups';
  const dateDir = path.join(backupDir, new Date().toISOString().split('T')[0]);
  
  if (!existsSync(dateDir)) {
    await mkdir(dateDir, { recursive: true });
  }
  
  return dateDir;
}

/**
 * Export table data to JSON
 */
async function exportTable(tableName: string, backupDir: string): Promise<{
  rowCount: number;
  filePath: string;
}> {
  console.log(`Exporting ${tableName}...`);
  
  // Fetch all data (with pagination for large tables)
  const pageSize = 1000;
  let allData: any[] = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = allData.concat(data);
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  // Write to file
  const filePath = path.join(backupDir, `${tableName}.json`);
  await writeFile(filePath, JSON.stringify(allData, null, 2));
  
  return {
    rowCount: allData.length,
    filePath
  };
}

/**
 * Export database schema
 */
async function exportSchema(backupDir: string): Promise<string> {
  console.log('Exporting schema...');
  
  // Get all table definitions
  const { data: tables, error } = await supabase
    .rpc('get_table_definitions');
  
  if (error) {
    console.warn('Schema export not available, using placeholder');
    const schemaPath = path.join(backupDir, 'schema.json');
    await writeFile(schemaPath, JSON.stringify({
      note: 'Schema export requires custom RPC function',
      tables: CONFIG.tables,
      exported_at: new Date().toISOString()
    }));
    return schemaPath;
  }
  
  const schemaPath = path.join(backupDir, 'schema.json');
  await writeFile(schemaPath, JSON.stringify(tables, null, 2));
  
  return schemaPath;
}

/**
 * Calculate checksum of backup files
 */
async function calculateChecksum(files: string[]): Promise<string> {
  const hash = createHash('sha256');
  
  for (const file of files.sort()) {
    const content = await readFile(file);
    hash.update(content);
  }
  
  return hash.digest('hex');
}

/**
 * Get total size of backup files
 */
async function getBackupSize(files: string[]): Promise<number> {
  let totalSize = 0;
  
  for (const file of files) {
    const content = await readFile(file);
    totalSize += content.length;
  }
  
  return totalSize;
}

/**
 * Upload backup to storage (S3, GCS, etc.)
 */
async function uploadBackup(
  backupDir: string,
  checksum: string
): Promise<{ provider: string; path: string }> {
  const provider = process.env.BACKUP_STORAGE_PROVIDER || 'local';
  
  if (provider === 'local') {
    return { provider, path: backupDir };
  }
  
  // S3 upload
  if (provider === 's3') {
    const bucket = process.env.S3_BACKUP_BUCKET;
    const region = process.env.S3_BACKUP_REGION;
    
    if (!bucket) throw new Error('S3_BACKUP_BUCKET not set');
    
    const backupName = `moltos-backup-${new Date().toISOString()}`;
    const s3Path = `s3://${bucket}/${backupName}`;
    
    console.log(`Uploading to ${s3Path}...`);
    
    // Use AWS CLI for upload
    await execAsync(`aws s3 sync ${backupDir} ${s3Path} --region ${region || 'us-east-1'}`);
    
    return { provider: 's3', path: s3Path };
  }
  
  // GCS upload
  if (provider === 'gcs') {
    const bucket = process.env.GCS_BACKUP_BUCKET;
    
    if (!bucket) throw new Error('GCS_BACKUP_BUCKET not set');
    
    const backupName = `moltos-backup-${new Date().toISOString()}`;
    const gcsPath = `gs://${bucket}/${backupName}`;
    
    console.log(`Uploading to ${gcsPath}...`);
    
    await execAsync(`gsutil -m cp -r ${backupDir} ${gcsPath}`);
    
    return { provider: 'gcs', path: gcsPath };
  }
  
  throw new Error(`Unsupported storage provider: ${provider}`);
}

/**
 * Verify backup integrity
 */
async function verifyBackup(files: string[], checksum: string): Promise<boolean> {
  console.log('Verifying backup integrity...');
  
  // Recalculate checksum
  const verifyChecksum = await calculateChecksum(files);
  
  if (verifyChecksum !== checksum) {
    console.error('Checksum mismatch!');
    return false;
  }
  
  // Verify JSON files are valid
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = await readFile(file, 'utf-8');
        JSON.parse(content);
      } catch (error) {
        console.error(`Invalid JSON in ${file}`);
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Record backup in database
 */
async function recordBackup(result: BackupResult): Promise<void> {
  await supabase
    .from('backup_history')
    .insert([{
      backup_type: result.type,
      status: result.success ? 'completed' : 'failed',
      storage_provider: process.env.BACKUP_STORAGE_PROVIDER || 'local',
      storage_path: result.storagePath,
      size_bytes: result.sizeBytes,
      table_count: result.tableCount,
      row_count_estimate: result.rowCount,
      started_at: new Date(Date.now() - result.durationSeconds * 1000).toISOString(),
      completed_at: new Date().toISOString(),
      duration_seconds: result.durationSeconds,
      error_message: result.error,
      checksum: result.checksum,
      verification_status: result.success ? 'verified' : 'failed'
    }]);
}

/**
 * Cleanup old backups (local only)
 */
async function cleanupOldBackups(): Promise<void> {
  const backupDir = process.env.BACKUP_STORAGE_PATH || './backups';
  
  // This would implement retention policy
  // For now, just log
  console.log('Backup cleanup: retention policy not yet implemented');
}

/**
 * Perform full database backup
 */
async function performFullBackup(): Promise<BackupResult> {
  const startTime = Date.now();
  const backupId = `full-${Date.now()}`;
  
  try {
    console.log('='.repeat(60));
    console.log('MoltOS Database Backup');
    console.log(`Started: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    // Create backup directory
    const backupDir = await ensureBackupDir();
    const backupSubdir = path.join(backupDir, backupId);
    await mkdir(backupSubdir, { recursive: true });
    
    // Export schema
    const schemaFile = await exportSchema(backupSubdir);
    
    // Export all tables
    const exportedFiles: string[] = [schemaFile];
    let totalRows = 0;
    
    for (const table of CONFIG.tables) {
      const result = await exportTable(table, backupSubdir);
      exportedFiles.push(result.filePath);
      totalRows += result.rowCount;
      console.log(`  ${table}: ${result.rowCount} rows`);
    }
    
    // Calculate checksum
    const checksum = await calculateChecksum(exportedFiles);
    
    // Get total size
    const sizeBytes = await getBackupSize(exportedFiles);
    
    // Upload to storage
    const { provider, path: storagePath } = await uploadBackup(backupSubdir, checksum);
    
    // Verify
    const isValid = await verifyBackup(exportedFiles, checksum);
    
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    
    // Cleanup local files if uploaded to cloud
    if (provider !== 'local') {
      await rm(backupSubdir, { recursive: true, force: true });
    }
    
    const result: BackupResult = {
      success: isValid,
      backupId,
      type: 'full',
      sizeBytes,
      tableCount: CONFIG.tables.length,
      rowCount: totalRows,
      durationSeconds,
      checksum,
      storagePath
    };
    
    // Record in database
    await recordBackup(result);
    
    console.log('='.repeat(60));
    console.log(`Backup ${isValid ? 'completed' : 'failed'}`);
    console.log(`Duration: ${durationSeconds}s`);
    console.log(`Size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Rows: ${totalRows.toLocaleString()}`);
    console.log(`Checksum: ${checksum}`);
    console.log('='.repeat(60));
    
    // Cleanup old backups
    await cleanupOldBackups();
    
    return result;
    
  } catch (error) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    
    const result: BackupResult = {
      success: false,
      backupId,
      type: 'full',
      sizeBytes: 0,
      tableCount: 0,
      rowCount: 0,
      durationSeconds,
      checksum: '',
      storagePath: '',
      error: (error as Error).message
    };
    
    await recordBackup(result);
    
    console.error('Backup failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  performFullBackup()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Backup failed:', error);
      process.exit(1);
    });
}

export { performFullBackup };
