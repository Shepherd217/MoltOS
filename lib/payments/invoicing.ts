/**
 * Invoice System for MoltOS
 * Handles PDF generation, payment terms, reminders, and late fees
 */

import { 
  Invoice, 
  InvoiceLineItem, 
  InvoiceStatus,
  PaymentTerm,
  PaymentReminder,
  Subscription,
  SubscriptionPlan,
  UsageMetrics,
  TaxCalculation
} from '@/types/billing';
import { createClient } from '@/lib/supabase/server';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Storage } from '@google-cloud/storage';

// ============================================================================
// Configuration
// ============================================================================

const INVOICE_PREFIX = 'INV-';
const LATE_FEE_PERCENTAGE = 0.015; // 1.5% per month
const LATE_FEE_GRACE_DAYS = 3;

const PAYMENT_TERM_DAYS: Record<PaymentTerm, number> = {
  due_on_receipt: 0,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
};

// ============================================================================
// Invoice Service Class
// ============================================================================

export class InvoiceService {
  private supabase = createClient();
  private storage = new Storage();

  /**
   * Generate a new invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const date = new Date();
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    // Get count of invoices this month for sequence
    const { count } = await this.supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(date.getFullYear(), date.getMonth(), 1).toISOString())
      .lt('created_at', new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString());

    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `${INVOICE_PREFIX}${yearMonth}-${sequence}`;
  }

  /**
   * Create a new invoice
   */
  async createInvoice(params: {
    customerId: string;
    subscriptionId?: string;
    lineItems: Partial<InvoiceLineItem>[];
    paymentTerm?: PaymentTerm;
    currency?: string;
    taxCalculation?: TaxCalculation;
    metadata?: Record<string, unknown>;
    dueDate?: Date;
  }): Promise<Invoice> {
    const {
      customerId,
      subscriptionId,
      lineItems,
      paymentTerm = 'net_30',
      currency = 'USD',
      taxCalculation,
      metadata = {},
      dueDate,
    } = params;

    // Calculate totals
    const calculatedLineItems: InvoiceLineItem[] = lineItems.map((item, index) => ({
      id: crypto.randomUUID(),
      description: item.description || 'Line item',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      amount: (item.quantity || 1) * (item.unitPrice || 0),
      periodStart: item.periodStart,
      periodEnd: item.periodEnd,
      proration: item.proration || false,
      metadata: item.metadata,
    }));

    const subtotal = calculatedLineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = taxCalculation?.taxAmount || 0;
    const total = subtotal + taxAmount;

    // Calculate due date
    const now = new Date();
    const calculatedDueDate = dueDate || new Date(
      now.getTime() + PAYMENT_TERM_DAYS[paymentTerm] * 24 * 60 * 60 * 1000
    );

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      customerId,
      subscriptionId,
      invoiceNumber: await this.generateInvoiceNumber(),
      status: 'open',
      currency,
      paymentTerm,
      createdAt: now,
      dueDate: calculatedDueDate,
      lineItems: calculatedLineItems,
      subtotal,
      taxAmount,
      discountAmount: 0,
      total,
      amountPaid: 0,
      amountDue: total,
      lateFees: 0,
      metadata,
    };

    const { data, error } = await this.supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single();

    if (error) throw new Error(`Failed to create invoice: ${error.message}`);

    // Schedule payment reminders
    await this.scheduleReminders(data.id, calculatedDueDate);

    // Emit event
    await this.emitEvent('invoice.created', data);

    return data;
  }

  /**
   * Create invoice from subscription
   */
  async createSubscriptionInvoice(
    subscription: Subscription,
    plan: SubscriptionPlan,
    overages: { total: number },
    priceCalculation: { base: number; discount: number; total: number }
  ): Promise<Invoice> {
    const lineItems: Partial<InvoiceLineItem>[] = [];

    // Base subscription charge
    lineItems.push({
      description: `${plan.name} - ${subscription.interval} subscription`,
      quantity: 1,
      unitPrice: priceCalculation.base,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    });

    // Discount line item (if applicable)
    if (priceCalculation.discount > 0) {
      lineItems.push({
        description: 'Discount',
        quantity: 1,
        unitPrice: -priceCalculation.discount,
      });
    }

    // Usage overages
    if (overages.total > 0) {
      lineItems.push({
        description: 'Usage overages',
        quantity: 1,
        unitPrice: overages.total,
      });
    }

    return this.createInvoice({
      customerId: subscription.customerId,
      subscriptionId: subscription.id,
      lineItems,
      currency: plan.pricing.currency,
    });
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(id: string): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get invoice by number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('invoice_number', invoiceNumber)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get customer invoices
   */
  async getCustomerInvoices(
    customerId: string,
    options?: {
      status?: InvoiceStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ invoices: Invoice[]; total: number }> {
    let query = this.supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Failed to fetch invoices: ${error.message}`);
    return { invoices: data || [], total: count || 0 };
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(
    invoiceId: string, 
    paymentDetails: {
      amount: number;
      paymentMethod: string;
      transactionId?: string;
      paidAt?: Date;
    }
  ): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const newAmountPaid = invoice.amountPaid + paymentDetails.amount;
    const isFullyPaid = newAmountPaid >= invoice.total;

    const updates: Partial<Invoice> = {
      amountPaid: newAmountPaid,
      amountDue: Math.max(invoice.total - newAmountPaid, 0),
      status: isFullyPaid ? 'paid' : invoice.status,
      paidAt: isFullyPaid ? (paymentDetails.paidAt || new Date()) : invoice.paidAt,
      metadata: {
        ...invoice.metadata,
        payments: [
          ...(invoice.metadata?.payments as [] || []),
          paymentDetails,
        ],
      },
    };

    const { data, error } = await this.supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw new Error(`Failed to mark invoice as paid: ${error.message}`);

    // Cancel pending reminders
    if (isFullyPaid) {
      await this.cancelReminders(invoiceId);
    }

    await this.emitEvent(isFullyPaid ? 'invoice.paid' : 'invoice.partially_paid', data);
    return data;
  }

  /**
   * Void an invoice
   */
  async voidInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.status === 'paid') {
      throw new Error('Cannot void a paid invoice');
    }

    const { data, error } = await this.supabase
      .from('invoices')
      .update({
        status: 'void',
        voidedAt: new Date(),
        metadata: {
          ...invoice.metadata,
          voidReason: reason,
        },
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw new Error(`Failed to void invoice: ${error.message}`);

    // Cancel pending reminders
    await this.cancelReminders(invoiceId);

    await this.emitEvent('invoice.voided', data);
    return data;
  }

  /**
   * Generate PDF invoice
   */
  async generatePDF(invoiceId: string): Promise<string> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    // Fetch customer details
    const { data: customer } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', invoice.customerId)
      .single();

    // Create PDF
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.text('INVOICE', 20, 30);
    
    doc.setFontSize(12);
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 20, 45);
    doc.text(`Date: ${invoice.createdAt.toLocaleDateString()}`, 20, 52);
    doc.text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`, 20, 59);
    doc.text(`Payment Terms: ${invoice.paymentTerm.replace('_', ' ').toUpperCase()}`, 20, 66);

    // Company info (right side)
    doc.setFontSize(14);
    doc.text('MoltOS Inc.', 140, 30);
    doc.setFontSize(10);
    doc.text('123 AI Boulevard', 140, 37);
    doc.text('San Francisco, CA 94102', 140, 44);
    doc.text('billing@moltos.com', 140, 51);

    // Customer info
    doc.setFontSize(12);
    doc.text('Bill To:', 20, 85);
    doc.setFontSize(10);
    doc.text(customer?.name || 'Customer', 20, 92);
    if (customer?.address) {
      doc.text(customer.address.line1 || '', 20, 99);
      if (customer.address.line2) {
        doc.text(customer.address.line2, 20, 106);
      }
      doc.text(`${customer.address.city}, ${customer.address.state} ${customer.address.postalCode}`, 20, customer.address.line2 ? 113 : 106);
      doc.text(customer.address.country, 20, customer.address.line2 ? 120 : 113);
    }

    // Line items table
    const tableData = invoice.lineItems.map(item => [
      item.description,
      item.periodStart ? `${item.periodStart.toLocaleDateString()} - ${item.periodEnd?.toLocaleDateString()}` : '',
      item.quantity.toString(),
      this.formatCurrency(item.unitPrice, invoice.currency),
      this.formatCurrency(item.amount, invoice.currency),
    ]);

    (doc as any).autoTable({
      startY: 130,
      head: [['Description', 'Period', 'Qty', 'Unit Price', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [66, 133, 244] },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Subtotal: ${this.formatCurrency(invoice.subtotal, invoice.currency)}`, 140, finalY, { align: 'right' });
    doc.text(`Tax: ${this.formatCurrency(invoice.taxAmount, invoice.currency)}`, 140, finalY + 7, { align: 'right' });
    if (invoice.discountAmount > 0) {
      doc.text(`Discount: -${this.formatCurrency(invoice.discountAmount, invoice.currency)}`, 140, finalY + 14, { align: 'right' });
    }
    if (invoice.lateFees > 0) {
      doc.text(`Late Fees: ${this.formatCurrency(invoice.lateFees, invoice.currency)}`, 140, finalY + (invoice.discountAmount > 0 ? 21 : 14), { align: 'right' });
    }
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`Total: ${this.formatCurrency(invoice.total + invoice.lateFees, invoice.currency)}`, 140, finalY + 30, { align: 'right' });
    doc.text(`Amount Due: ${this.formatCurrency(invoice.amountDue, invoice.currency)}`, 140, finalY + 40, { align: 'right' });

    // Payment instructions
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Payment Instructions:', 20, finalY + 55);
    doc.text('Wire Transfer: MoltOS Inc., Account: ****1234, Routing: 021000021', 20, finalY + 62);
    doc.text('Or pay online at: https://billing.moltos.com/pay/' + invoice.invoiceNumber, 20, finalY + 69);

    // Save to storage
    const pdfBuffer = doc.output('arraybuffer');
    const fileName = `invoices/${invoice.customerId}/${invoice.invoiceNumber}.pdf`;
    
    await this.storage.bucket('moltos-billing').file(fileName).save(Buffer.from(pdfBuffer), {
      contentType: 'application/pdf',
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    const [url] = await this.storage.bucket('moltos-billing').file(fileName).getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Update invoice with PDF URL
    await this.supabase
      .from('invoices')
      .update({ pdf_url: url })
      .eq('id', invoiceId);

    return url;
  }

  /**
   * Schedule payment reminders
   */
  private async scheduleReminders(invoiceId: string, dueDate: Date): Promise<void> {
    const reminders: Partial<PaymentReminder>[] = [
      {
        invoiceId,
        type: 'upcoming',
        scheduledAt: new Date(dueDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
        status: 'pending',
      },
      {
        invoiceId,
        type: 'due_soon',
        scheduledAt: new Date(dueDate.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before
        status: 'pending',
      },
      {
        invoiceId,
        type: 'overdue',
        scheduledAt: new Date(dueDate.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day after
        status: 'pending',
      },
      {
        invoiceId,
        type: 'final_notice',
        scheduledAt: new Date(dueDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after
        status: 'pending',
      },
    ];

    await this.supabase.from('payment_reminders').insert(reminders);
  }

  /**
   * Cancel pending reminders
   */
  private async cancelReminders(invoiceId: string): Promise<void> {
    await this.supabase
      .from('payment_reminders')
      .update({ status: 'cancelled' })
      .eq('invoice_id', invoiceId)
      .eq('status', 'pending');
  }

  /**
   * Process due reminders
   */
  async processReminders(): Promise<void> {
    const now = new Date();
    
    const { data: reminders } = await this.supabase
      .from('payment_reminders')
      .select('*, invoice:invoices(*)')
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString());

    if (!reminders || reminders.length === 0) return;

    for (const reminder of reminders) {
      try {
        await this.sendReminder(reminder);
        
        await this.supabase
          .from('payment_reminders')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', reminder.id);
      } catch (error) {
        console.error('Failed to send reminder:', error);
        await this.supabase
          .from('payment_reminders')
          .update({ status: 'failed' })
          .eq('id', reminder.id);
      }
    }
  }

  /**
   * Send reminder notification
   */
  private async sendReminder(reminder: PaymentReminder & { invoice: Invoice }): Promise<void> {
    const templates: Record<string, string> = {
      upcoming: `Your invoice ${reminder.invoice.invoiceNumber} for ${this.formatCurrency(reminder.invoice.amountDue, reminder.invoice.currency)} is due on ${reminder.invoice.dueDate.toLocaleDateString()}.`,
      due_soon: `Reminder: Invoice ${reminder.invoice.invoiceNumber} for ${this.formatCurrency(reminder.invoice.amountDue, reminder.invoice.currency)} is due tomorrow.`,
      overdue: `Your invoice ${reminder.invoice.invoiceNumber} is now overdue. Please submit payment to avoid late fees.`,
      final_notice: `FINAL NOTICE: Invoice ${reminder.invoice.invoiceNumber} is seriously overdue. Immediate payment required to avoid service interruption.`,
    };

    const message = templates[reminder.type];
    
    // Implementation would send email/SMS notification
    console.log(`[${reminder.type.toUpperCase()}] ${message}`);

    // If overdue, apply late fee
    if (reminder.type === 'overdue') {
      await this.applyLateFee(reminder.invoice.id);
    }
  }

  /**
   * Apply late fee to overdue invoice
   */
  async applyLateFee(invoiceId: string): Promise<Invoice> {
    const invoice = await this.getInvoice(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (invoice.status !== 'open') {
      return invoice; // No late fees on non-open invoices
    }

    const daysOverdue = Math.floor(
      (Date.now() - invoice.dueDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysOverdue <= LATE_FEE_GRACE_DAYS) {
      return invoice; // Grace period
    }

    // Calculate monthly late fee
    const monthsOverdue = Math.floor(daysOverdue / 30) || 1;
    const lateFee = invoice.total * LATE_FEE_PERCENTAGE * monthsOverdue;

    const { data, error } = await this.supabase
      .from('invoices')
      .update({
        late_fees: lateFee,
        total: invoice.total + lateFee,
        amount_due: invoice.amountDue + lateFee,
        metadata: {
          ...invoice.metadata,
          lateFeeApplied: new Date().toISOString(),
          lateFeeAmount: lateFee,
        },
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw new Error(`Failed to apply late fee: ${error.message}`);

    await this.emitEvent('invoice.late_fee_applied', data);
    return data;
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    
    const { data, error } = await this.supabase
      .from('invoices')
      .select('*')
      .eq('status', 'open')
      .lt('due_date', now.toISOString())
      .order('due_date', { ascending: true });

    if (error) throw new Error(`Failed to fetch overdue invoices: ${error.message}`);
    return data || [];
  }

  /**
   * Calculate days until due
   */
  getDaysUntilDue(invoice: Invoice): number {
    const now = new Date();
    const diff = invoice.dueDate.getTime() - now.getTime();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  }

  /**
   * Check if invoice is overdue
   */
  isOverdue(invoice: Invoice): boolean {
    return invoice.status === 'open' && new Date() > invoice.dueDate;
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  }

  /**
   * Emit webhook event
   */
  private async emitEvent(event: string, data: unknown): Promise<void> {
    console.log(`[Invoice Event] ${event}`, data);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function calculateDueDate(createdAt: Date, term: PaymentTerm): Date {
  return new Date(createdAt.getTime() + PAYMENT_TERM_DAYS[term] * 24 * 60 * 60 * 1000);
}

export function getPaymentTermDays(term: PaymentTerm): number {
  return PAYMENT_TERM_DAYS[term];
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const invoiceService = new InvoiceService();
