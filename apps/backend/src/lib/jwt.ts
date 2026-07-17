import jwt, { SignOptions } from "jsonwebtoken";

function secrets(): string[] {
  const current = process.env.JWT_SECRET;
  if (!current) throw new Error("JWT_SECRET is not set");
  const previous = process.env.JWT_SECRET_PREVIOUS;
  return previous ? [current, previous] : [current];
}

export function signToken(payload: object, options?: SignOptions): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, options);
}

export function verifyToken<T extends object>(token: string): T {
  let lastError: unknown;
  for (const secret of secrets()) {
    try {
      return jwt.verify(token, secret) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
