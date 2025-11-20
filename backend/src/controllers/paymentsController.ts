import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { respondError, respondSuccess } from '../lib/responses';
import { getEnv } from '../lib/env';
import { createCheckoutPreference, handlePaymentWebhook } from '../services/mercadoPagoService';
import { getLiveWithCreator, recordPayment } from '../services/supabaseService';
import { parseWithZod } from '../validation/utils';
import { createPaymentSchema } from '../validation/paymentsSchemas';
import { verifyMercadoPagoSignature } from '../shared/mercadoPagoSignature';

export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { liveId } = parseWithZod(createPaymentSchema, req.body ?? {});
    const userId = req.auth?.profileId;

    if (!userId) {
      return respondError(res, 401, 'Authentication required');
    }

    const live = await getLiveWithCreator(liveId);

    if (!live || live.price === null) {
      return respondError(res, 404, 'Live not found or missing price');
    }

    if (live.status && ['ending', 'ended'].includes(live.status)) {
      return respondError(res, 409, 'This live is no longer available for purchase');
    }

    const amount = Number(live.price);

    if (!Number.isFinite(amount) || amount <= 0) {
      return respondError(res, 422, 'Live price must be a positive number');
    }

    const paymentRecord = await recordPayment({
      userId,
      liveId,
      amount,
      status: 'pending',
    });

    const preference = await createCheckoutPreference({
      liveId,
      userId,
      price: amount,
      paymentId: paymentRecord.id,
    });

    logger.info({ event: 'payments.create', liveId, userId, paymentId: paymentRecord.id, amount });

    return respondSuccess(res, 201, {
      ...preference,
      amount,
      paymentId: paymentRecord.id,
    });
  } catch (error) {
    next(error);
  }
};

export const webhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userAgent = (req.headers['user-agent'] as string | undefined)?.toLowerCase() || '';
    if (!userAgent.includes('mercadopago')) {
      logger.warn({ event: 'mercadopago.webhook.rejected', reason: 'invalid_user_agent', userAgent });
      return respondError(res, 403, 'Unauthorized webhook source');
    }

    const signature = req.headers['x-signature'] as string | undefined;
    const requestId = req.headers['x-request-id'] as string | undefined;
    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;
    const rawBody = req.rawBody;

    if (!idempotencyKey) {
      logger.warn({ event: 'mercadopago.webhook.rejected', reason: 'missing_idempotency', requestId });
      return respondError(res, 400, 'Missing idempotency key');
    }

    if (!rawBody) {
      logger.error({ event: 'mercadopago.webhook.rejected', reason: 'missing_raw_body', requestId });
      return respondError(res, 400, 'Raw body unavailable for signature validation');
    }

    const signatureResult = verifyMercadoPagoSignature({
      rawBody,
      signatureHeader: signature,
      secret: getEnv('MERCADOPAGO_WEBHOOK_SECRET'),
    });

    if (!signatureResult.isValid) {
      logger.warn({
        event: 'mercadopago.webhook.signature_invalid',
        requestId,
        idempotencyKey,
        reason: signatureResult.reason,
        expectedHmac: signatureResult.expectedHmac,
        receivedHmac: signatureResult.receivedHmac,
        timestamp: signatureResult.timestamp,
      });
      const status = signatureResult.reason === 'stale_timestamp' ? 400 : 401;
      return respondError(res, status, 'Invalid Mercado Pago signature');
    }

    logger.info({
      event: 'mercadopago.webhook.signature_valid',
      requestId,
      idempotencyKey,
      timestamp: signatureResult.timestamp,
    });

    logger.info({
      event: 'mercadopago.webhook.received',
      requestId,
      idempotencyKey,
    });

    const result = await handlePaymentWebhook(req.body, { signature, requestId, idempotencyKey }, rawBody);

    logger.info({ event: 'mercadopago.webhook.processed', requestId, idempotencyKey, processed: result.processed });
    return respondSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
};
