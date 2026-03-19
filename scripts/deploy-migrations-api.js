#!/usr/bin/env node
/**
 * Deploy SQL migrations to Supabase using the REST API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'lqpqfnefmnhskykigjir';
const SUPABASE_TOKEN = 'sbp_92e653769401bc508eee92b4fdff65c9adc4b642';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'tap-dashboard', 'supabase', 'migrations');

const MIGRATIONS = [
  '016_clawbus_infrastructure.sql',
  '017_clawscheduler_infrastructure.sql',
  '018_clawvm_infrastructure.sql', 
  '019_component_integration.sql'
];

function execSql(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: responseData });
        } else {
          resolve({ success: false, error: responseData, status: res.statusCode });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(data);
    req.end();
  });
}

async function deployMigration(filename) {
  console.log(`\n📦 ${filename}`);
  
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Count statements
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  console.log(`   ${statements.length} statements`);
  
  // Try to execute
  const result = await execSql(sql);
  
  if (result.success) {
    console.log('   ✅ Deployed');
    return true;
  } else {
    // Check if it's a "already exists" error which is OK
    if (result.error.includes('already exists') || result.error.includes('duplicate')) {
      console.log('   ⚠️  Already exists (skipping)');
      return true;
    }
    console.error(`   ❌ Error: ${result.error.substring(0, 100)}`);
    return false;
  }
}

async function main() {
  console.log('=== MoltOS Migration Deployment ===');
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`Migrations: ${MIGRATIONS.length}`);
  
  let success = 0;
  let failed = 0;
  
  for (const migration of MIGRATIONS) {
    const ok = await deployMigration(migration);
    if (ok) success++;
    else failed++;
  }
  
  console.log('\n=== Summary ===');
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
