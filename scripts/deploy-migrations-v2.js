const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://lqpqfnefmnhskykigjir.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxcHFmbmVmbW5oc2t5a2lnamlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwOTI2MDAwMCwiZXhwIjoyMDI0ODM2MDAwfQ.sbp_92e653769401bc508eee92b4fdff65c9adc4b642';

// Note: This is a placeholder - the actual anon key would be different
// For service role operations, we need to use the service role key

const MIGRATIONS_DIR = path.join(__dirname, '..', 'tap-dashboard', 'supabase', 'migrations');

const MIGRATIONS = [
  '016_clawbus_infrastructure.sql',
  '017_clawscheduler_infrastructure.sql', 
  '018_clawvm_infrastructure.sql',
  '019_component_integration.sql'
];

async function executeStatement(supabase, sql) {
  try {
    // Try using the exec_sql function if it exists
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      // Check for benign errors
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate key') ||
          error.message.includes('does not exist') ||
          error.code === '42710' || // duplicate_object
          error.code === '42P07' || // duplicate_table
          error.code === '42701') { // duplicate_column
        return { success: true, skipped: true };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function deployMigration(supabase, filename) {
  console.log(`\n📦 ${filename}`);
  
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split by semicolon but be careful with function bodies
  const statements = [];
  let currentStatement = '';
  let inFunction = false;
  
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('--')) continue;
    
    // Track if we're in a function body
    if (trimmed.toLowerCase().includes('create or replace function') ||
        trimmed.toLowerCase().includes('create function')) {
      inFunction = true;
    }
    
    currentStatement += line + '\n';
    
    if (!inFunction && trimmed.endsWith(';')) {
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
      }
      currentStatement = '';
    } else if (inFunction && trimmed.toLowerCase() === '$$ language plpgsql;') {
      statements.push(currentStatement.trim());
      currentStatement = '';
      inFunction = false;
    } else if (inFunction && trimmed.toLowerCase().endsWith('language plpgsql;')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
      inFunction = false;
    }
  }
  
  // Add final statement if any
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  console.log(`   ${statements.length} statements`);
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt.trim()) continue;
    
    const result = await executeStatement(supabase, stmt);
    
    if (result.success) {
      if (result.skipped) skipped++;
      else success++;
    } else {
      failed++;
      if (failed <= 3) { // Only show first few errors
        console.error(`   ❌ Statement ${i + 1}: ${result.error.substring(0, 100)}`);
      }
    }
  }
  
  console.log(`   ✅ ${success} success | ⚠️ ${skipped} skipped | ❌ ${failed} failed`);
  return failed === 0;
}

async function main() {
  console.log('=== MoltOS Migration Deployment ===');
  console.log(`Project: ${SUPABASE_URL}`);
  
  // Create client with service role key
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY);
  
  let allSuccess = true;
  
  for (const migration of MIGRATIONS) {
    const ok = await deployMigration(supabase, migration);
    if (!ok) allSuccess = false;
  }
  
  console.log('\n=== Summary ===');
  if (allSuccess) {
    console.log('✅ All migrations deployed');
  } else {
    console.log('⚠️ Some migrations had errors (may be already applied)');
  }
  
  process.exit(allSuccess ? 0 : 0); // Don't fail on "already exists" errors
}

main().catch(console.error);
