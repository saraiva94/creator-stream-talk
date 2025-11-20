import { Request, Response, NextFunction } from 'express';
import { respondError } from '../lib/responses';
import { supabase } from '../lib/supabaseClient';
import { getCreatorByProfileId, getProfileById } from '../services/supabaseService';

const extractBearerToken = (authorization?: string) => {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token.trim();
};

const isAdminUser = (user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}) => {
  const collectRoles = (metadata?: Record<string, unknown>) => {
    if (!metadata) return [] as string[];
    const rolesField = metadata.roles;
    if (Array.isArray(rolesField)) {
      return rolesField.map((value) => value?.toString().toLowerCase());
    }
    if (typeof rolesField === 'string') {
      return [rolesField.toLowerCase()];
    }
    return [] as string[];
  };

  const primaryRole =
    (user.app_metadata?.app_role as string | undefined) ||
    (user.user_metadata?.app_role as string | undefined) ||
    (user.app_metadata?.role as string | undefined) ||
    (user.user_metadata?.role as string | undefined);

  const roles = new Set<string>([
    ...collectRoles(user.app_metadata),
    ...collectRoles(user.user_metadata),
  ]);

  if (primaryRole) {
    roles.add(primaryRole.toLowerCase());
  }

  return roles.has('admin');
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return respondError(res, 401, 'Authorization token missing');
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return respondError(res, 401, 'Invalid or expired token');
    }

    const user = data.user;
    const profileId = user.id;

    const profile = await getProfileById(profileId);
    if (!profile) {
      return respondError(res, 403, 'Profile not found for authenticated user');
    }

    const creator = await getCreatorByProfileId(profileId);

    req.auth = {
      userId: user.id,
      email: user.email ?? (profile as { email?: string } | null)?.email ?? undefined,
      profileId,
      creatorId: creator?.id ?? null,
      isAdmin: isAdminUser(user),
    };

    return next();
  } catch (error) {
    return respondError(res, 500, (error as Error).message);
  }
};

export const requireCreatorAccount = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth?.creatorId) {
    return respondError(res, 403, 'Creator account is required for this action');
  }
  return next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth?.isAdmin) {
    return respondError(res, 403, 'Admin privileges are required for this action');
  }
  return next();
};
