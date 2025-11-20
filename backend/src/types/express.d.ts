import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      userId: string;
      email?: string;
      profileId: string;
      creatorId: string | null;
      isAdmin: boolean;
    };
    rawBody?: Buffer;
  }
}
