// Augments Express's Request type so `req.user` is known everywhere without
// casting. Populated by `middleware/auth.ts` after verifying the access token.
export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}
