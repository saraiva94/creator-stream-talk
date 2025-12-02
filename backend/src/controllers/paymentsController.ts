import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient';
import {
  createCheckoutPreference,
  createRegistrationPreference as createRegistrationCheckoutPreference,
  handlePaymentWebhook,
} from '../services/mercadoPagoService';

export const createPreference = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { liveId, userId, price, purchaseType, metadata, paymentId, referrerId, referrerParentId } = req.body ?? {};
    const normalizedPrice = Number(price);
    const normalizedType = (purchaseType ?? 'live_access').toLowerCase();

    if (!userId || Number.isNaN(normalizedPrice) || normalizedPrice <= 0) {
      return res.status(400).json({
        error: 'userId and a positive price are required.',
      });
    }

    if (normalizedType !== 'credits' && normalizedType !== 'credits_purchase' && !liveId) {
      return res.status(400).json({ error: 'liveId is required for live purchases.' });
    }

    const effectivePaymentId = paymentId ?? crypto.randomUUID();

    const preference = await createCheckoutPreference({
      liveId,
      userId,
      price: normalizedPrice,
      purchaseType: normalizedType,
      paymentId: effectivePaymentId,
      referrerId,
      referrerParentId,
      metadata,
    });
    res.status(201).json(preference);
  } catch (error) {
    next(error);
  }
};

export const createRegistrationPreference = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, parentId } = req.body ?? {};

    if (!userId || !parentId) {
      return res.status(400).json({ error: 'userId and parentId are required for registration.' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, status')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to load profile for registration: ${profileError.message}`);
    }

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found for registration payment.' });
    }

    if (profile.status && profile.status !== 'pending_payment') {
      return res.status(400).json({ error: 'Registration payment is only available for pending accounts.' });
    }

    const { data: referral, error: referralError } = await supabase
      .from('referrals')
      .select('referrer_id')
      .eq('referred_id', userId)
      .order('created_at', { ascending: true })
      .maybeSingle();

    if (referralError) {
      throw new Error(`Failed to load referral for registration: ${referralError.message}`);
    }

    const resolvedParent = referral?.referrer_id || parentId;

    if (!resolvedParent) {
      return res.status(400).json({ error: 'Parent relationship missing for invite registration.' });
    }

    const preference = await createRegistrationCheckoutPreference({ userId, parentId: resolvedParent });
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
