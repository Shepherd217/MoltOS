/**
 * CloserAgent - Email-Based Deal Closer
 * Takes leads, sends personalized emails, closes deals, collects payments
 */

import { Agent } from '../core/Agent';
import { getAIProvider } from '../utils/DualAI';

interface EmailConfig {
  resendApiKey: string;
  fromEmail: string;
  fromName: string;
  stripeKey?: string;
}

interface Lead {
  id: string;
  source: string;
  author: string;
  email?: string;
  content: string;
  painPoint: string;
  proposedSolution: string;
  estimatedValue: number;
  status: 'new' | 'emailed' | 'responded' | 'pitched' | 'closed' | 'lost';
  emailHistory: EmailHistory[];
}

interface EmailHistory {
  type: 'initial' | 'followup1' | 'followup2' | 'pitch';
  sentAt: Date;
  subject: string;
  opened?: boolean;
  replied?: boolean;
}

export class CloserAgent extends Agent {
  private ai = getAIProvider();
  private config: EmailConfig;
  private leads: Lead[] = [];
  private leadsClosed: number = 0;
  private revenueClosed: number = 0;

  constructor(config: EmailConfig) {
    super({ agentId: 'closer-agent', agentType: 'sales' });
    this.config = config;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.success('CloserAgent ACTIVE - Closing deals via email 24/7');

    // Process leads every 30 minutes
    while (this.isRunning) {
      await this.processNewLeads();
      await this.followUpOnLeads();
      await this.sleep(30 * 60 * 1000); // 30 minutes
    }
  }

  private async processNewLeads(): Promise<void> {
    // In production, would fetch from database
    // For now, simulate finding new high-value leads
    const newLeads = this.simulateNewLeads();
    
    for (const lead of newLeads) {
      if (lead.estimatedValue >= 300) { // Only go after $300+ deals
        await this.sendInitialEmail(lead);
        this.leads.push(lead);
        this.logger.success(`Sent initial email to ${lead.author} ($${lead.estimatedValue} deal)`);
      }
    }
  }

  private async sendInitialEmail(lead: Lead): Promise<void> {
    const subject = await this.generateSubject(lead);
    const body = await this.generateEmailBody(lead, 'initial');

    try {
      await this.sendEmail({
        to: lead.email || `${lead.author.replace(/[^a-zA-Z0-9]/g, '')}@temp.com`, // Fallback
        subject,
        body,
        leadId: lead.id
      });

      lead.status = 'emailed';
      lead.emailHistory.push({
        type: 'initial',
        sentAt: new Date(),
        subject,
        opened: false,
        replied: false
      });

    } catch (error) {
      this.logger.error(`Failed to send email to ${lead.author}:`, error);
    }
  }

  private async followUpOnLeads(): Promise<void> {
    try {
      for (const lead of this.leads) {
        try {
          // Skip leads with no email history
          if (!lead.emailHistory || lead.emailHistory.length === 0) {
            continue;
          }
          
          const lastEmail = lead.emailHistory[lead.emailHistory.length - 1];
          
          // Skip if lastEmail or sentAt is undefined
          if (!lastEmail || !lastEmail.sentAt) {
            this.logger.warn(`Lead ${lead.author} has incomplete email history, skipping follow-up`);
            continue;
          }
          
          const daysSinceEmail = (Date.now() - lastEmail.sentAt.getTime()) / (1000 * 60 * 60 * 24);

          // Follow up #1: 2 days later if no reply
          if (lead.status === 'emailed' && daysSinceEmail >= 2 && lead.emailHistory.length === 1) {
            await this.sendFollowUp(lead, 1);
          }

          // Follow up #2: 5 days later if still no reply
          if (lead.status === 'emailed' && daysSinceEmail >= 5 && lead.emailHistory.length === 2) {
            await this.sendFollowUp(lead, 2);
          }

          // Simulate occasional positive responses (in production, would check inbox)
          if (lead.status === 'emailed' && Math.random() > 0.7) {
            lead.status = 'responded';
            this.logger.success(`Lead ${lead.author} responded! Sending pitch...`);
            await this.sendPitchEmail(lead);
          }
        } catch (leadError) {
          this.logger.error(`Failed to process follow-up for lead ${lead.author}:`, leadError);
          // Continue with next lead, don't crash entire process
          continue;
        }
      }
    } catch (error) {
      this.logger.error('Critical error in followUpOnLeads:', error);
      // Don't rethrow - let the service continue running
    }
  }

  private async sendFollowUp(lead: Lead, followUpNumber: number): Promise<void> {
    const subject = followUpNumber === 1 
      ? `Re: ${lead.emailHistory[0].subject}`
      : `Last follow-up: ${lead.painPoint.split(' ').slice(0, 5).join(' ')}...`;
    
    const body = await this.generateEmailBody(lead, `followup${followUpNumber}` as 'followup1' | 'followup2');

    await this.sendEmail({
      to: lead.email || `${lead.author.replace(/[^a-zA-Z0-9]/g, '')}@temp.com`,
      subject,
      body,
      leadId: lead.id
    });

    lead.emailHistory.push({
      type: followUpNumber === 1 ? 'followup1' : 'followup2',
      sentAt: new Date(),
      subject,
      opened: false,
      replied: false
    });

    this.logger.info(`Follow-up ${followUpNumber} sent to ${lead.author}`);
  }

  private async sendPitchEmail(lead: Lead): Promise<void> {
    const subject = `Here's what I can do for you, ${lead.author}`;
    const body = await this.generateEmailBody(lead, 'pitch');
    const paymentLink = this.generateStripeLink(lead);

    const fullBody = `${body}

Ready to get started? Here's your secure payment link:
${paymentLink}

Once payment is received, I'll deliver within 7 days.

Best,
${this.config.fromName}`;

    await this.sendEmail({
      to: lead.email || `${lead.author.replace(/[^a-zA-Z0-9]/g, '')}@temp.com`,
      subject,
      body: fullBody,
      leadId: lead.id
    });

    lead.status = 'pitched';
    lead.emailHistory.push({
      type: 'pitch',
      sentAt: new Date(),
      subject,
      opened: false,
      replied: false
    });

    this.logger.success(`Pitch sent to ${lead.author} with payment link`);
  }

  private async generateSubject(lead: Lead): Promise<string> {
    const prompt = `Write a compelling email subject line (max 50 chars) for a cold email to someone who posted about: "${lead.painPoint}". Make it personalized and curiosity-inducing. No spam words.`;
    return this.ai.generate(prompt, { maxTokens: 60 });
  }

  private async generateEmailBody(lead: Lead, type: 'initial' | 'followup1' | 'followup2' | 'pitch'): Promise<string> {
    let prompt = '';

    switch (type) {
      case 'initial':
        prompt = `Write a personalized cold email to ${lead.author} who posted about needing help with: "${lead.painPoint}".

The offer: I can build an AI solution for $${lead.estimatedValue}.

Requirements:
- Friendly, conversational tone
- Reference their specific pain point
- Brief (3-4 sentences max)
- Soft ask (not pushy)
- End with a question

Sign off as ${this.config.fromName}`;
        break;

      case 'followup1':
        prompt = `Write a brief follow-up email to ${lead.author} who I emailed 2 days ago about helping with: "${lead.painPoint}".

Requirements:
- Friendly reminder
- Add value (share a quick tip or insight)
- Still soft ask
- 2-3 sentences

Sign off as ${this.config.fromName}`;
        break;

      case 'followup2':
        prompt = `Write a final follow-up email to ${lead.author} about their need for: "${lead.painPoint}".

Requirements:
- Acknowledge they might be busy
- Offer to help whenever they're ready
- No pressure
- 2 sentences max

Sign off as ${this.config.fromName}`;
        break;

      case 'pitch':
        prompt = `Write a detailed pitch email to ${lead.author} who expressed interest in solving: "${lead.painPoint}".

The solution: Custom AI automation
Price: $${lead.estimatedValue}
Delivery: 7 days

Requirements:
- Outline exactly what they'll get
- Include social proof ("I've helped similar clients...")
- Clear next steps
- Professional but warm

Sign off as ${this.config.fromName}`;
        break;
    }

    return this.ai.generate(prompt, { maxTokens: 500 });
  }

  private async sendEmail(params: { to: string; subject: string; body: string; leadId: string }): Promise<void> {
    // Check if using Gmail SMTP
    if (process.env.EMAIL_PROVIDER === 'gmail') {
      await this.sendEmailGmail(params);
      return;
    }

    // Fallback to Resend
    if (!this.config.resendApiKey || this.config.resendApiKey === 'your-resend-api-key') {
      // Simulate sending if no API key
      this.logger.info(`[SIMULATED] Email sent to ${params.to}: ${params.subject}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${this.config.fromName} <${this.config.fromEmail}>`,
          to: params.to,
          subject: params.subject,
          text: params.body
        })
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.status}`);
      }

      this.logger.success(`Email sent to ${params.to}`);
    } catch (error) {
      this.logger.error('Email send failed:', error);
      throw error;
    }
  }

  private async sendEmailGmail(params: { to: string; subject: string; body: string; leadId: string }): Promise<void> {
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    try {
      await transporter.sendMail({
        from: `${process.env.GMAIL_FROM_NAME} <${process.env.GMAIL_FROM_EMAIL}>`,
        to: params.to,
        subject: params.subject,
        text: params.body,
        html: params.body.replace(/\n/g, '<br>')
      });

      this.logger.success(`✅ Email sent to ${params.to} via Gmail SMTP`);
    } catch (error) {
      this.logger.error('❌ Gmail SMTP failed:', error);
      throw error;
    }
  }

  private generateStripeLink(lead: Lead): string {
    // In production, would generate real Stripe payment link
    // For now, return simulated link
    return `https://buy.stripe.com/simulated_${lead.id}_${lead.estimatedValue}`;
  }

  private simulateNewLeads(): Lead[] {
    // Simulate finding 1-3 new high-value leads
    const count = Math.floor(Math.random() * 3) + 1;
    const leads: Lead[] = [];

    const painPoints = [
      { pain: 'Need to automate my email responses', solution: 'AI email triage agent', value: 500 },
      { pain: 'Looking for podcast editing service', solution: 'AI podcast production', value: 2000 },
      { pain: 'Need help with lead generation', solution: 'AI lead scraper', value: 1500 },
      { pain: 'Want to automate social media', solution: 'Social media automation', value: 800 },
      { pain: 'Need AI chatbot for my website', solution: 'Custom AI chatbot', value: 1200 }
    ];

    for (let i = 0; i < count; i++) {
      const random = painPoints[Math.floor(Math.random() * painPoints.length)];
      leads.push({
        id: `lead-${Date.now()}-${i}`,
        source: 'reddit',
        author: `prospect${Math.floor(Math.random() * 1000)}`,
        content: `I ${random.pain}`,
        painPoint: random.pain,
        proposedSolution: random.solution,
        estimatedValue: random.value,
        status: 'new',
        emailHistory: []
      });
    }

    return leads;
  }

  // Called when payment received (from webhook or manual check)
  onPaymentReceived(leadId: string): void {
    const lead = this.leads.find(l => l.id === leadId);
    if (lead) {
      lead.status = 'closed';
      this.leadsClosed++;
      this.revenueClosed += lead.estimatedValue;
      this.logger.money(`DEAL CLOSED! ${lead.author} paid $${lead.estimatedValue}`, lead.estimatedValue);
      
      // Trigger fulfillment
      this.triggerFulfillment(lead);
    }
  }

  private triggerFulfillment(lead: Lead): void {
    // In production, would notify other agents to fulfill
    this.logger.info(`Triggering fulfillment for ${lead.proposedSolution}`);
    
    // Route to appropriate agent
    if (lead.proposedSolution.includes('podcast')) {
      this.logger.success('Routed to PodcastProducerAgent');
    } else if (lead.proposedSolution.includes('lead')) {
      this.logger.success('Routed to LeadGenerationAgent');
    } else {
      this.logger.success('Routed to appropriate fulfillment agent');
    }
  }

  getStats(): { leadsContacted: number; leadsClosed: number; revenue: number; inPipeline: number } {
    return {
      leadsContacted: this.leads.length,
      leadsClosed: this.leadsClosed,
      revenue: this.revenueClosed,
      inPipeline: this.leads.filter(l => l.status === 'emailed' || l.status === 'responded' || l.status === 'pitched').length
    };
  }

  stop(): void {
    this.isRunning = false;
    this.logger.info('CloserAgent stopped');
  }
}
