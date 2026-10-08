import type { PublicUser } from '../lib/serializers.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the loadUser middleware when a valid session token is present. */
      user?: PublicUser;
    }
  }
}

export {};
