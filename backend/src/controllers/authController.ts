import { NextFunction, Request, Response } from 'express';
import { respondSuccess } from '../lib/responses';
import { getProfileByUsername } from '../services/supabaseService';

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
