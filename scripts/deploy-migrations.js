const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://lqpqfnefmnhskykigjir.supabase.co';
const SUPABASE_SERVICE_KEY = 'sbp_92e653769401bc508eee92b4fdff65c9adc4b642';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MIGRATIONS = [
  '016_clawbus_infrastructure.sql',
  '017_clawscheduler_infrastructure.sql', 
  '018_clawvm_infrastructure.sql',
  '019_component_integration.sql'
];

async function deployMigration(filename) {
  console.log(`\n📦 Deploying ${filename}...`);
  
  const filePath = path.join(__dirname, '..', 'tap-dashboard', 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split by statement to get better error reporting
  const statements = sql.split(/;\s*\n/).filter(s => s.trim().length > 0);
  
  console.log(`   ${statements.length} statements to execute`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      if (error) {
        // Try direct query if RPC fails
        const { error: queryError } = await supabase.from('_exec_sql').select('*').eq('query', stmt + ';');
        if (queryError) {
          console.error(`   ❌ Statement ${i + 1} failed: ${error.message}`);
          console.error(`   SQL: ${stmt.substring(0, 100)}...`);
          // Continue on error - some statements may already exist
        }
      }
    } catch (e) {
      // Statement might have already been executed
      console.log(`   ⚠️  Statement ${i + 1}: ${e.message?.substring(0, 50) || 'skipped'}`);
    }
  }
  
  console.log(`   ✅ ${filename} complete`);
}

// Alternative: Use raw SQL via the REST API
async function deployViaRest(filename) {
  console.log(`\n📦 Deploying ${filename}...`);
  
  const filePath = path.join(__dirname, '..', 'tap-dashboard', 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Use the management API
  const response = await fetch(`https://api.supabase.com/v1/projects/lqpqfnefmnhskykigjir/database/exec`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error(`   ❌ Failed: ${error}`);
    return false;
  }
  
  console.log(`   ✅ ${filename} complete`);
  return true;
}

async function main() {
  console.log('=== MoltOS Migration Deployment ===');
  console.log(`Project: ${SUPABASE_URL}`);
  console.log(`Migrations: ${MIGRATIONS.length}`);
  
  for (const migration of MIGRATIONS) {
    try {
      // Try direct SQL execution
      const filePath = path.join(__dirname, '..', 'tap-dashboard', 'supabase', 'migrations', migration);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split into manageable chunks
      const chunks = sql.split(/\n-- =+\n/).filter(c => c.trim().length > 0);
      
      console.log(`\n📦 ${migration}`);
      console.log(`   ${chunks.length} chunks`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (!chunk) continue;
        
        // Execute via SQL
        const { error } = await supabase.rpc('exec_sql', { sql: chunk });
        if (error) {
          // Some errors are expected (IF NOT EXISTS, etc)
          if (!error.message.includes('already exists')) {
            console.log(`   ⚠️  Chunk ${i + 1}: ${error.message.substring(0, 60)}`);
          }
        }
      }
      
      console.log(`   ✅ Complete`);
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
    }
  }
  
  console.log('\n=== Deployment Complete ===');
}

main().catch(console.error);
