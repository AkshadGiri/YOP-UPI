import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface CreatePaymentInput {
  transactionId: string;
  amount: string;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  providerOrderId: string;
  providerPaymentId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
}

export interface VerifyPaymentResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  providerPaymentId: string;
  amount?: string;
  currency?: string;
}

export interface RefundPaymentInput {
  providerPaymentId: string;
  amount: string;
  reason?: string;
}

export interface RefundPaymentResult {
  refundId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
}

export interface GetPaymentStatusInput {
  providerOrderId: string;
}

export interface GetPaymentStatusResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  providerOrderId?: string;
  amount?: string;
  currency?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    logger.info('MockPaymentProvider: createPayment', { transactionId: input.transactionId, amount: input.amount });
    return {
      providerOrderId: 'mock_order_' + input.transactionId,
      providerPaymentId: 'mock_pay_' + input.transactionId,
      status: 'SUCCESS',
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    logger.info('MockPaymentProvider: verifyPayment', input);
    return { status: 'SUCCESS', providerPaymentId: input.providerPaymentId };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    logger.info('MockPaymentProvider: refundPayment', { providerPaymentId: input.providerPaymentId, amount: input.amount });
    return { refundId: 'mock_refund_' + input.providerPaymentId, status: 'SUCCESS' };
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusResult> {
    logger.info('MockPaymentProvider: getPaymentStatus', input);
    return { status: 'SUCCESS', providerOrderId: input.providerOrderId };
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return true;
  }
}

class RealPaymentProvider implements PaymentProvider {
  readonly name: string;

  constructor() {
    this.name = env.PSP_PROVIDER_NAME || 'real';
    if (!env.PSP_API_KEY || !env.PSP_API_SECRET) {
      throw new Error('RealPaymentProvider requires PSP_API_KEY and PSP_API_SECRET');
    }
  }

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new Error('RealPaymentProvider.createPayment not implemented');
  }

  async verifyPayment(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    throw new Error('RealPaymentProvider.verifyPayment not implemented');
  }

  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentResult> {
    throw new Error('RealPaymentProvider.refundPayment not implemented');
  }

  async getPaymentStatus(_input: GetPaymentStatusInput): Promise<GetPaymentStatusResult> {
    throw new Error('RealPaymentProvider.getPaymentStatus not implemented');
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    throw new Error('RealPaymentProvider.verifyWebhookSignature not implemented');
  }
}

function resolveProvider(): PaymentProvider {
  if (env.DEMO_MODE || env.PAYMENT_MODE === 'mock') {
    logger.info('Payment provider: MockPaymentProvider');
    return new MockPaymentProvider();
  }
  logger.info('Payment provider: RealPaymentProvider');
  return new RealPaymentProvider();
}

export const paymentProvider = resolveProvider();