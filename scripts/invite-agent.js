#!/usr/bin/env node

/**
 * Invite Agent Script
 * 
 * Generates invite codes for new agents with tier-based benefits.
 * Supports founding agents (Cohort #1), early adopters, and standard invites.
 * 
 * Usage:
 *   node invite-agent.js --generate --tier founding
 *   node invite-agent.js --generate --tier early-adopter --count 5
 *   node invite-agent.js --validate CODE
 *   node invite-agent.js --redeem CODE --agent-id AGENT_123
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  cohorts: {
    founding: {
      id: 1,
      name: 'Cohort #1 - Founding Agents',
      maxSpots: 10,
      commissionRate: 0.15, // 15%
      benefits: [
        'lifetime_commission',
        'founding_badge',
        'early_access',
        'revenue_share',
        'voting_rights',
        'zero_fees_10k',
        'vip_support'
      ],
      expiresAt: null // Never expires
    },
    'early-adopter': {
      id: 2,
      name: 'Cohort #2 - Early Adopters',
      maxSpots: 90,
      commissionRate: 0.10, // 10%
      benefits: [
        'lifetime_commission',
        'early_adopter_badge',
        'early_access',
        'priority_support'
      ],
      expiresAt: '2026-06-30'
    },
    standard: {
      id: 3,
      name: 'Standard',
      maxSpots: Infinity,
      commissionRate: 0.05, // 5%
      benefits: [
        'standard_commission',
        'community_access'
      ],
      expiresAt: null
    }
  },
  reputationThreshold: 50,
  codeLength: 12,
  codePrefix: 'AGENT'
};

// Storage file for generated codes
const STORAGE_FILE = path.join(__dirname, '..', 'data', 'invite-codes.json');

/**
 * Ensure storage directory exists
 */
function ensureStorage() {
  const dir = path.dirname(STORAGE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({
      codes: [],
      redemptions: [],
      stats: {
        totalGenerated: 0,
        totalRedeemed: 0,
        byTier: {}
      }
    }, null, 2));
  }
}

/**
 * Load stored data
 */
function loadData() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
}

/**
 * Save data to storage
 */
function saveData(data) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Generate a cryptographically secure invite code
 */
function generateCode(tier = 'standard') {
  const randomBytes = crypto.randomBytes(8);
  const hash = crypto.createHash('sha256').update(randomBytes).digest('hex');
  const code = `${CONFIG.codePrefix}-${tier.toUpperCase().substring(0, 4)}-${hash.substring(0, 8).toUpperCase()}`;
  return code;
}

/**
 * Generate multiple invite codes
 */
function generateCodes(options = {}) {
  const { tier = 'standard', count = 1, referrerId = null, metadata = {} } = options;
  
  if (!CONFIG.cohorts[tier]) {
    throw new Error(`Invalid tier: ${tier}. Valid tiers: ${Object.keys(CONFIG.cohorts).join(', ')}`);
  }
  
  const data = loadData();
  const cohort = CONFIG.cohorts[tier];
  
  // Check cohort availability
  const currentCount = data.codes.filter(c => c.tier === tier && !c.redeemedAt).length;
  const redeemedCount = data.codes.filter(c => c.tier === tier && c.redeemedAt).length;
  
  if (tier === 'founding' && redeemedCount >= cohort.maxSpots) {
    throw new Error(`Cohort #1 is full! All ${cohort.maxSpots} founding agent spots have been claimed.`);
  }
  
  if (count > (cohort.maxSpots - redeemedCount) && tier !== 'standard') {
    throw new Error(`Only ${cohort.maxSpots - redeemedCount} spots remaining in ${cohort.name}`);
  }
  
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    const code = generateCode(tier);
    const codeData = {
      code,
      tier,
      cohortId: cohort.id,
      commissionRate: cohort.commissionRate,
      benefits: cohort.benefits,
      referrerId,
      metadata,
      createdAt: new Date().toISOString(),
      expiresAt: cohort.expiresAt,
      redeemedAt: null,
      redeemedBy: null,
      status: 'active'
    };
    
    data.codes.push(codeData);
    codes.push(codeData);
    data.stats.totalGenerated++;
  }
  
  data.stats.byTier[tier] = (data.stats.byTier[tier] || 0) + count;
  
  saveData(data);
  
  return codes;
}

/**
 * Validate an invite code
 */
function validateCode(code) {
  const data = loadData();
  const codeData = data.codes.find(c => c.code === code);
  
  if (!codeData) {
    return { valid: false, reason: 'Invalid code' };
  }
  
  if (codeData.status === 'revoked') {
    return { valid: false, reason: 'Code has been revoked' };
  }
  
  if (codeData.redeemedAt) {
    return { valid: false, reason: 'Code already redeemed' };
  }
  
  if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date()) {
    return { valid: false, reason: 'Code has expired' };
  }
  
  return {
    valid: true,
    code: codeData.code,
    tier: codeData.tier,
    cohortId: codeData.cohortId,
    commissionRate: codeData.commissionRate,
    benefits: codeData.benefits,
    referrerId: codeData.referrerId
  };
}

/**
 * Redeem an invite code
 */
function redeemCode(code, agentId, agentReputation = 0) {
  const validation = validateCode(code);
  
  if (!validation.valid) {
    throw new Error(validation.reason);
  }
  
  // Check reputation for founding tier
  if (validation.tier === 'founding' && agentReputation < CONFIG.reputationThreshold) {
    throw new Error(
      `Reputation requirement not met. ` +
      `Required: >${CONFIG.reputationThreshold}, ` +
      `Current: ${agentReputation}`
    );
  }
  
  const data = loadData();
  const codeIndex = data.codes.findIndex(c => c.code === code);
  
  if (codeIndex === -1) {
    throw new Error('Code not found');
  }
  
  // Mark as redeemed
  data.codes[codeIndex].redeemedAt = new Date().toISOString();
  data.codes[codeIndex].redeemedBy = agentId;
  data.codes[codeIndex].status = 'redeemed';
  
  // Record redemption
  data.redemptions.push({
    code,
    agentId,
    tier: validation.tier,
    reputationAtRedemption: agentReputation,
    redeemedAt: new Date().toISOString(),
    referrerId: validation.referrerId
  });
  
  data.stats.totalRedeemed++;
  
  saveData(data);
  
  return {
    success: true,
    agentId,
    tier: validation.tier,
    commissionRate: validation.commissionRate,
    benefits: validation.benefits,
    referrerId: validation.referrerId
  };
}

/**
 * Get cohort statistics
 */
function getStats() {
  const data = loadData();
  const stats = {
    cohorts: {},
    overall: {
      totalGenerated: data.stats.totalGenerated,
      totalRedeemed: data.stats.totalRedeemed,
      conversionRate: data.stats.totalGenerated > 0 
        ? ((data.stats.totalRedeemed / data.stats.totalGenerated) * 100).toFixed(2) + '%'
        : '0%'
    }
  };
  
  for (const [tier, config] of Object.entries(CONFIG.cohorts)) {
    const tierCodes = data.codes.filter(c => c.tier === tier);
    const redeemed = tierCodes.filter(c => c.redeemedAt).length;
    
    stats.cohorts[tier] = {
      name: config.name,
      totalSpots: config.maxSpots === Infinity ? 'Unlimited' : config.maxSpots,
      remaining: config.maxSpots === Infinity ? 'Unlimited' : config.maxSpots - redeemed,
      generated: tierCodes.length,
      redeemed,
      commissionRate: (config.commissionRate * 100) + '%',
      isOpen: config.maxSpots === Infinity || redeemed < config.maxSpots
    };
  }
  
  return stats;
}

/**
 * CLI Interface
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse flags
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '').replace(/-/g, '_');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      flags[key] = value;
      if (value !== true) i++;
    }
  }
  
  try {
    switch (command) {
      case '--generate':
      case '-g': {
        const tier = flags.tier || 'standard';
        const count = parseInt(flags.count) || 1;
        const referrerId = flags.referrer_id || null;
        
        console.log(`\n🔑 Generating ${count} invite code(s) for tier: ${tier}\n`);
        
        const codes = generateCodes({ tier, count, referrerId });
        
        codes.forEach((codeData, i) => {
          console.log(`  ${i + 1}. ${codeData.code}`);
          console.log(`     Tier: ${codeData.tier}`);
          console.log(`     Commission: ${(codeData.commissionRate * 100)}%`);
          console.log(`     Created: ${codeData.createdAt}`);
          console.log('');
        });
        
        console.log(`✅ Successfully generated ${codes.length} code(s)\n`);
        break;
      }
        
      case '--validate':
      case '-v': {
        const code = flags._ || args[1];
        if (!code) {
          console.error('❌ Please provide a code to validate');
          process.exit(1);
        }
        
        console.log(`\n🔍 Validating code: ${code}\n`);
        
        const result = validateCode(code);
        
        if (result.valid) {
          console.log('✅ Code is valid!\n');
          console.log(`  Tier: ${result.tier}`);
          console.log(`  Cohort ID: ${result.cohortId}`);
          console.log(`  Commission Rate: ${(result.commissionRate * 100)}%`);
          console.log(`  Benefits: ${result.benefits.join(', ')}`);
          if (result.referrerId) {
            console.log(`  Referrer: ${result.referrerId}`);
          }
        } else {
          console.log(`❌ Code is invalid: ${result.reason}`);
        }
        console.log('');
        break;
      }
        
      case '--redeem':
      case '-r': {
        const code = flags._ || args[1];
        const agentId = flags.agent_id;
        const reputation = parseInt(flags.reputation) || 0;
        
        if (!code || !agentId) {
          console.error('❌ Usage: --redeem CODE --agent-id AGENT_ID [--reputation SCORE]');
          process.exit(1);
        }
        
        console.log(`\n🎁 Redeeming code: ${code}\n`);
        
        const result = redeemCode(code, agentId, reputation);
        
        console.log('✅ Code redeemed successfully!\n');
        console.log(`  Agent ID: ${result.agentId}`);
        console.log(`  Tier: ${result.tier}`);
        console.log(`  Commission Rate: ${(result.commissionRate * 100)}%`);
        console.log(`  Benefits unlocked: ${result.benefits.length}`);
        console.log('');
        break;
      }
        
      case '--stats':
      case '-s': {
        const stats = getStats();
        
        console.log('\n📊 Invite Code Statistics\n');
        console.log('Overall:');
        console.log(`  Total Generated: ${stats.overall.totalGenerated}`);
        console.log(`  Total Redeemed: ${stats.overall.totalRedeemed}`);
        console.log(`  Conversion Rate: ${stats.overall.conversionRate}`);
        console.log('');
        
        console.log('By Cohort:');
        for (const [tier, stat] of Object.entries(stats.cohorts)) {
          const status = stat.isOpen ? '🟢 OPEN' : '🔴 CLOSED';
          console.log(`\n  ${stat.name} ${status}`);
          console.log(`    Spots: ${stat.redeemed}/${stat.totalSpots} (Remaining: ${stat.remaining})`);
          console.log(`    Codes Generated: ${stat.generated}`);
          console.log(`    Commission: ${stat.commissionRate}`);
        }
        console.log('');
        break;
      }
        
      case '--help':
      case '-h':
      default:
        console.log(`
🚀 SDK Verification - Invite Agent Script

Usage:
  node invite-agent.js [command] [options]

Commands:
  --generate, -g          Generate new invite code(s)
    --tier <tier>         Tier: founding|early-adopter|standard (default: standard)
    --count <n>           Number of codes to generate (default: 1)
    --referrer-id <id>    ID of referring agent

  --validate, -v <code>   Validate an invite code

  --redeem, -r <code>     Redeem an invite code
    --agent-id <id>       Agent ID (required)
    --reputation <score>  Agent's reputation score

  --stats, -s             Show cohort statistics

  --help, -h              Show this help message

Examples:
  # Generate a founding agent invite
  node invite-agent.js --generate --tier founding

  # Generate 5 early adopter codes
  node invite-agent.js --generate --tier early-adopter --count 5

  # Validate a code
  node invite-agent.js --validate AGENT-FOUN-A1B2C3D4

  # Redeem a code
  node invite-agent.js --redeem AGENT-FOUN-A1B2C3D4 --agent-id AGENT_123 --reputation 75

  # Check cohort status
  node invite-agent.js --stats
`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Export functions for use as module
module.exports = {
  generateCodes,
  validateCode,
  redeemCode,
  getStats,
  CONFIG
};

// Run CLI if called directly
if (require.main === module) {
  main();
}
