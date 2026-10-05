import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { paymentProvider } from '../../services/paymentProvider';
import { logger } from '../../utils/logger';
import { TransactionStatus } from '@prisma/client';

export async function paymentWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = (req.headers['x-webhook-signature'] ?? req.headers['x-razorpay-signature'] ?? '') as string;
  const rawBody = JSON.stringify(req.body);

  const isValid = paymentProvider.verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    logger.warn('Webhook: invalid signature', { signature });
    throw new AppError('UNAUTHORIZED', 'Invalid webhook signature');
  }

  const payload = req.body as {
    event?: string;
    referenceId?: string;
    providerOrderId?: string;
    providerPaymentId?: string;
    amount?: string;
    currency?: string;
    status?: string;
  };

  logger.info('Webhook received', { event: payload.event, referenceId: payload.referenceId });

  if (!payload.referenceId) {
    res.json({ success: true, data: { message: 'No referenceId â€” ignoring' } });
    return;
  }

  const transaction = await prisma.transaction.findUnique({
    where: { referenceId: payload.referenceId },
  });

  if (!transaction) {
    logger.warn('Webhook: transaction not found', { referenceId: payload.referenceId });
    res.json({ success: true, data: { message: 'Transaction not found â€” ignoring' } });
    return;
  }

  if (payload.amount && transaction.amount.toString() !== payload.amount) {
    logger.error('Webhook: amount mismatch', { expected: transaction.amount.toString(), received: payload.amount });
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Amount mismatch' } });
    return;
  }

  if (payload.providerPaymentId && transaction.providerPaymentId === payload.providerPaymentId) {
    logger.info('Webhook: duplicate event ignored', { providerPaymentId: payload.providerPaymentId });
    res.json({ success: true, data: { message: 'Duplicate event â€” already processed' } });
    return;
  }

  let newStatus: TransactionStatus = transaction.status;
  const providerStatus = (payload.status ?? '').toLowerCase();
  if (['success', 'captured', 'paid', 'completed'].includes(providerStatus)) {
    newStatus = TransactionStatus.SUCCESS;
  } else if (['failed', 'failure', 'rejected'].includes(providerStatus)) {
    newStatus = TransactionStatus.FAILED;
  } else if (['refunded', 'reversed'].includes(providerStatus)) {
    newStatus = TransactionStatus.REVERSED;
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: newStatus,
        providerOrderId: payload.providerOrderId ?? transaction.providerOrderId,
        providerPaymentId: payload.providerPaymentId ?? transaction.providerPaymentId,
      },
    });

    await tx.paymentProviderTransaction.create({
      data: {
        transactionId: transaction.id,
        provider: paymentProvider.name,
        providerOrderId: payload.providerOrderId,
        providerPaymentId: payload.providerPaymentId,
        status: payload.status ?? 'unknown',
        rawPayload: payload as object,
      },
    });
  });

  logger.info('Webhook: transaction updated', { transactionId: transaction.transactionId, oldStatus: transaction.status, newStatus });

  res.json({ success: true, data: { transactionId: transaction.transactionId, status: newStatus } });
}
