import { Request, Response, NextFunction } from 'express';
import {
  createCheckoutPreference,
  handlePaymentWebhook,
} from '../services/mercadoPagoService';

export const createPreference = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { liveId, userId, price } = req.body ?? {};
    const normalizedPrice = Number(price);

    if (!liveId || !userId || Number.isNaN(normalizedPrice) || normalizedPrice <= 0) {
      return res.status(400).json({
        error: 'liveId, userId, and a positive price are required.',
      });
    }

    const preference = await createCheckoutPreference({ liveId, userId, price: normalizedPrice });
    res.status(201).json(preference);
  } catch (error) {
    next(error);
  }
};

export const webhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-signature'] as string | undefined;
    const requestId = req.headers['x-request-id'] as string | undefined;

    await handlePaymentWebhook(req.body, { signature, requestId });

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};
