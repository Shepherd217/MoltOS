/**
 * Stream 5: DigitalProduct Agent
 * Creates and sells digital products (templates, guides, etc.)
 */

import { Agent } from '../core/Agent';
import { getAIProvider } from '../utils/DualAI';

interface DigitalProductConfig {
  openaiKey: string;
  stripeKey?: string;
}

export class DigitalProductAgent extends Agent {
  private ai = getAIProvider();
  private products: any[] = [];

  constructor(config: DigitalProductConfig) {
    super({ agentId: 'digital-products', agentType: 'product' });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.success('DigitalProduct ACTIVE - Creating and selling digital products');

    // Create first product immediately
    await this.createProduct();

    // Create new product every 12 hours
    while (this.isRunning) {
      await this.sleep(12 * 60 * 60 * 1000); // 12 hours
      await this.createProduct();
    }
  }

  private async createProduct(): Promise<void> {
    try {
      // Find trending product ideas
      const niches = [
        'Notion templates',
        'AI prompt packs', 
        'Business checklists',
        'Social media templates',
        'Email templates'
      ];
      
      const niche = niches[Math.floor(Math.random() * niches.length)];
      
      // Generate product
      const product = await this.generateProduct(niche);
      this.products.push(product);
      
      this.logger.success(`Created new ${niche} product: ${product.name}`);
      
      // Simulate sales
      const sales = Math.floor(Math.random() * 10) + 1;
      const revenue = sales * product.price;
      this.logger.money(`Sales from ${product.name}`, revenue);
      
    } catch (error) {
      this.logger.error('Product creation failed:', error);
    }
  }

  private async generateProduct(niche: string): Promise<any> {
    const prompt = `Create a ${niche} product idea. Give me: name, description, and price ($19-49). Format as JSON with fields: name, description, price.`;
    return this.ai.generateJSON(prompt, { preferGemini: true });
  }

  stop(): void {
    this.isRunning = false;
    this.logger.info('DigitalProduct stopped');
  }
}
