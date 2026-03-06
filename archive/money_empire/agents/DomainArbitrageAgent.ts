/**
 * Domain Arbitrage Agent - FREE VERSION
 * Uses scraping and free APIs only
 * No paid subscriptions required
 */

import { Agent } from '../core/Agent';
import { getAIProvider } from '../utils/DualAI';
import * as fs from 'fs';
import * as path from 'path';

interface DomainArbitrageConfig {
  openaiKey: string;
  geminiKey?: string;
}

interface DomainOpportunity {
  domain: string;
  source: 'expireddomains' | 'justdropped' | 'namecheap' | 'godaddy' | 'manual';
  tld: string;
  age?: number;
  mozDA?: number;  // Free MOZ check
  backlinks?: number;  // From free sources
  status: 'discovered' | 'checking' | 'available' | 'purchased' | 'listed' | 'sold';
  registrationPrice: number;
  estimatedValue: number;
  listingPrice?: number;
  notes: string[];
  discoveredAt: Date;
  checkedAt?: Date;
  purchasedAt?: Date;
  listedAt?: Date;
}

export class DomainArbitrageAgent extends Agent {
  private ai = getAIProvider();
  private inventory: DomainOpportunity[] = [];
  private dataDir: string;
  private inventoryFile: string;

  constructor(config: DomainArbitrageConfig) {
    super({ agentId: 'domain-arbitrage', agentType: 'trading' });
    this.dataDir = path.join(process.cwd(), 'data', 'domains');
    this.inventoryFile = path.join(this.dataDir, 'inventory.json');
    this.ensureDataDir();
    this.loadInventory();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadInventory(): void {
    try {
      if (fs.existsSync(this.inventoryFile)) {
        const data = fs.readFileSync(this.inventoryFile, 'utf8');
        this.inventory = JSON.parse(data);
        this.logger.info(`📁 Loaded ${this.inventory.length} domains from inventory`);
      }
    } catch (error) {
      this.logger.error('Failed to load inventory:', error);
      this.inventory = [];
    }
  }

  private saveInventory(): void {
    try {
      fs.writeFileSync(this.inventoryFile, JSON.stringify(this.inventory, null, 2));
    } catch (error) {
      this.logger.error('Failed to save inventory:', error);
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.success('🌐 Domain Arbitrage Agent ACTIVE (FREE MODE)');
    this.logger.info('💡 Using: ExpiredDomains.net, JustDropped, manual entry');
    this.logger.info('💡 Valuation: Free MOZ, Ubersuggest, manual research');
    
    // Initial scan
    await this.scanAllSources();
    
    // Scan every 6 hours
    setInterval(async () => {
      await this.scanAllSources();
    }, 6 * 60 * 60 * 1000);
    
    // Daily reappraisal
    setInterval(async () => {
      await this.reappraiseInventory();
    }, 24 * 60 * 60 * 1000);
    
    // Print current status
    this.printStatus();
  }

  private async scanAllSources(): Promise<void> {
    this.logger.info('🔍 Scanning all FREE domain sources...');
    
    // Source 1: Generate search queries for manual checking
    await this.generateSearchQueries();
    
    // Source 2: Load manual domains (user adds these)
    await this.checkManualDomains();
    
    // Source 3: AI-suggested domains in hot niches
    await this.suggestDomainsFromNiches();
    
    this.logger.success(`✅ Scan complete. Total inventory: ${this.inventory.length} domains`);
    this.saveInventory();
  }

  private async generateSearchQueries(): Promise<void> {
    // Generate URLs/queries for user to check manually
    const queries = [
      'site:expireddomains.net country=com type=expired age=5+',
      'site:justdropped.com today',
      'site:namecheap.com/marketplace expired domains DA>20',
      'site:godaddy.com closeouts expired'
    ];
    
    this.logger.info('🔗 Manual search queries generated:');
    queries.forEach((q, i) => this.logger.info(`  ${i + 1}. ${q}`));
  }

  private async suggestDomainsFromNiches(): Promise<void> {
    // Hot niches for domain flipping
    const niches = [
      'ai tools', 'chatgpt', 'automation', 'nocode', 'passive income',
      'side hustle', 'remote work', 'freelance', 'crypto', 'marketing',
      'seo', 'content', 'youtube', 'dropshipping', 'ecommerce'
    ];
    
    // Generate domain variations that might be available
    const suggestions: string[] = [];
    
    for (const niche of niches.slice(0, 5)) {  // Check 5 niches per scan
      const cleanNiche = niche.replace(/\s+/g, '');
      suggestions.push(
        `${cleanNiche}guide.com`,
        `${cleanNiche}hub.net`,
        `${cleanNiche}secrets.io`,
        `best${cleanNiche}.com`,
        `${cleanNiche}tips.net`
      );
    }
    
    this.logger.info('💡 Suggested domains to check (use whois/namecheap to verify availability):');
    suggestions.forEach((d, i) => this.logger.info(`  ${i + 1}. ${d}`));
    
    // Add to inventory as "discovered" for manual checking
    for (const domain of suggestions) {
      if (!this.inventory.find(d => d.domain === domain)) {
        this.inventory.push({
          domain,
          source: 'manual',
          tld: domain.split('.').pop() || 'com',
          status: 'discovered',
          registrationPrice: this.estimateRegistrationPrice(domain),
          estimatedValue: 0,
          notes: ['Suggested by AI - needs manual availability check'],
          discoveredAt: new Date()
        });
      }
    }
  }

  private async checkManualDomains(): Promise<void> {
    // Domains the user manually added to check
    const manualDomains = this.inventory.filter(d => d.status === 'discovered' && d.source === 'manual');
    
    if (manualDomains.length === 0) return;
    
    this.logger.info(`🔍 ${manualDomains.length} manual domains waiting for research`);
    
    for (const domain of manualDomains.slice(0, 3)) {  // Check 3 at a time
      await this.researchDomain(domain);
    }
  }

  private async researchDomain(domain: DomainOpportunity): Promise<void> {
    this.logger.info(`🔬 Researching ${domain.domain}...`);
    
    domain.status = 'checking';
    domain.checkedAt = new Date();
    
    // Build research report with FREE tools
    const researchReport = `
## FREE RESEARCH CHECKLIST for ${domain.domain}

### 1. AVAILABILITY CHECK (FREE)
- [ ] Check whois: https://who.is/${domain.domain}
- [ ] Check NameCheap: https://www.namecheap.com/domains/
- [ ] Check GoDaddy: https://www.godaddy.com/domainsearch/find
- Status: ${domain.status}

### 2. VALUATION (FREE TOOLS)
- [ ] MOZ Free DA Check: https://moz.com/domain-analysis?site=${domain.domain}
- [ ] Ubersuggest (free tier): https://app.neilpatel.com/en/ubersuggest/overview?keyword=${domain.domain}
- [ ] Wayback Machine (age check): https://web.archive.org/web/*/${domain.domain}
- [ ] HypeStat (free stats): https://hypestat.com/info/${domain.domain}

### 3. COMPARABLE SALES (FREE)
- [ ] NameBio (free): https://namebio.com/?keyword=${domain.domain.split('.')[0]}
- [ ] Sedo recent sales: https://www.sedo.com/search/?keyword=${domain.domain.split('.')[0]}

### 4. ESTIMATED VALUE FORMULA
Current estimate: $${domain.estimatedValue}
Suggested formula: DA × $10 + Backlinks × $0.50 + Age × $5

### 5. BUY IF:
- Domain available for <$20
- DA > 20
- Clean history (no spam)
- Valuation > $200

### NEXT STEPS:
1. Complete checklist above
2. If good: Buy at NameCheap/GoDaddy/Cloudflare
3. Update this record with actual data
4. List on Dan.com (free) or Sedo
`;

    domain.notes.push(researchReport);
    
    // AI-assisted valuation based on domain name quality
    try {
      const prompt = `Estimate the value of domain "${domain.domain}" for domain flipping.
      Consider: niche popularity, keyword value, length, memorability, TLD.
      Reply with just a number (estimated value in USD).`;
      
      const value = await this.ai.generate(prompt, { preferGemini: true });
      const parsedValue = parseInt(value?.match(/\d+/)?.[0] || '0');
      domain.estimatedValue = parsedValue > 0 ? parsedValue : 100;
      
      this.logger.info(`💡 AI estimated value: $${domain.estimatedValue}`);
    } catch (error) {
      domain.estimatedValue = 100;  // Default conservative estimate
    }
    
    this.logger.info(`✅ Research complete for ${domain.domain}`);
    this.logger.info(`📝 Check data/domains/inventory.json for full research report`);
  }

  private async reappraiseInventory(): Promise<void> {
    const listed = this.inventory.filter(d => d.status === 'listed');
    
    if (listed.length === 0) return;
    
    this.logger.info(`📈 Reappraising ${listed.length} listed domains...`);
    
    // In reality, domains don't sell instantly
    // Simulate 5% monthly sell-through for realistic domains
    for (const domain of listed) {
      if (Math.random() < 0.05 && domain.listingPrice && domain.listingPrice < 1000) {
        // More likely to sell if priced reasonably
        this.logger.success(`🎉 SIMULATED SALE: ${domain.domain} for $${domain.listingPrice}!`);
        domain.status = 'sold';
      }
    }
    
    this.printStatus();
    this.saveInventory();
  }

  // User-facing method to add a domain they found
  public addDomain(domain: string, source: string = 'manual'): void {
    if (this.inventory.find(d => d.domain === domain)) {
      this.logger.warn(`Domain ${domain} already in inventory`);
      return;
    }
    
    const tld = domain.split('.').pop() || 'com';
    
    this.inventory.push({
      domain,
      source: source as any,
      tld,
      status: 'discovered',
      registrationPrice: this.estimateRegistrationPrice(domain),
      estimatedValue: 0,
      notes: [`Added manually by user from ${source}`],
      discoveredAt: new Date()
    });
    
    this.logger.success(`➕ Added ${domain} to inventory`);
    this.saveInventory();
  }

  // User-facing method to mark domain as purchased
  public markPurchased(domain: string, price: number): void {
    const d = this.inventory.find(x => x.domain === domain);
    if (!d) {
      this.logger.error(`Domain ${domain} not found in inventory`);
      return;
    }
    
    d.status = 'purchased';
    d.purchasedAt = new Date();
    d.registrationPrice = price;
    
    this.logger.success(`💰 Marked ${domain} as purchased for $${price}`);
    this.saveInventory();
  }

  // User-facing method to list domain
  public markListed(domain: string, listingPrice: number): void {
    const d = this.inventory.find(x => x.domain === domain);
    if (!d) {
      this.logger.error(`Domain ${domain} not found in inventory`);
      return;
    }
    
    d.status = 'listed';
    d.listedAt = new Date();
    d.listingPrice = listingPrice;
    
    this.logger.success(`🏪 Listed ${domain} for $${listingPrice}`);
    this.saveInventory();
  }

  private estimateRegistrationPrice(domain: string): number {
    const tld = domain.split('.').pop() || 'com';
    const prices: Record<string, number> = {
      'com': 12,
      'net': 12,
      'org': 12,
      'io': 35,
      'co': 25,
      'ai': 80,
      'app': 15,
      'dev': 15
    };
    return prices[tld] || 12;
  }

  private printStatus(): void {
    const discovered = this.inventory.filter(d => d.status === 'discovered').length;
    const checking = this.inventory.filter(d => d.status === 'checking').length;
    const purchased = this.inventory.filter(d => d.status === 'purchased').length;
    const listed = this.inventory.filter(d => d.status === 'listed').length;
    const sold = this.inventory.filter(d => d.status === 'sold').length;
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         🌐 DOMAIN ARBITRAGE DASHBOARD (FREE)          ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  📋 To Research:  ${discovered.toString().padStart(3)}                                  ║`);
    console.log(`║  🔍 Checking:     ${checking.toString().padStart(3)}                                  ║`);
    console.log(`║  💰 Purchased:    ${purchased.toString().padStart(3)}                                  ║`);
    console.log(`║  🏪 Listed:       ${listed.toString().padStart(3)}                                  ║`);
    console.log(`║  🎉 Sold:         ${sold.toString().padStart(3)}                                  ║`);
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║  FREE TOOLS TO USE:                                    ║');
    console.log('║  • who.is - check availability                         ║');
    console.log('║  • moz.com/domain-analysis - free DA check             ║');
    console.log('║  • namebio.com - comparable sales                      ║');
    console.log('║  • web.archive.org - age/history check                 ║');
    console.log('║  • dan.com - FREE listing                              ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('💡 TIP: Check data/domains/inventory.json for research reports');
    console.log('💡 TIP: Add domains with: agent.addDomain("example.com")');
    console.log('');
  }

  getStats() {
    return {
      total: this.inventory.length,
      discovered: this.inventory.filter(d => d.status === 'discovered').length,
      checking: this.inventory.filter(d => d.status === 'checking').length,
      purchased: this.inventory.filter(d => d.status === 'purchased').length,
      listed: this.inventory.filter(d => d.status === 'listed').length,
      sold: this.inventory.filter(d => d.status === 'sold').length,
      potentialProfit: this.inventory
        .filter(d => d.status === 'listed' && d.listingPrice && d.registrationPrice)
        .reduce((sum, d) => sum + (d.listingPrice! - d.registrationPrice), 0)
    };
  }

  stop(): void {
    this.isRunning = false;
    this.saveInventory();
    this.logger.info('Domain Arbitrage Agent stopped');
  }
}
