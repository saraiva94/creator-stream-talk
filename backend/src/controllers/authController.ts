import { NextFunction, Request, Response } from 'express';
import { respondSuccess } from '../lib/responses';
import { getProfileByUsername, validateResetCredential } from '../services/supabaseService';

export const resolveUsername = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const username = (req.query.username as string | undefined)?.trim();

    if (!username) {
      const error = new Error('username is required');
      (error as { status?: number }).status = 400;
      throw error;
    }

    const profile = await getProfileByUsername(username);

    if (!profile?.email) {
      const error = new Error('User not found');
      (error as { status?: number }).status = 404;
      throw error;
    }

    return respondSuccess(res, 200, { email: profile.email });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if email or username exists for password reset validation
 * POST /api/auth/validate-reset-credential
 * Body: { credential: string }
 */
export const validateResetCredentialHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credential = (req.body?.credential as string | undefined)?.trim();

    if (!credential) {
      const error = new Error('credential is required');
      (error as { status?: number }).status = 400;
      throw error;
    }

    const result = await validateResetCredential(credential);

    return respondSuccess(res, 200, { 
      exists: result.exists, 
      type: result.type 
    });
  } catch (error) {
    next(error);
  }
};
