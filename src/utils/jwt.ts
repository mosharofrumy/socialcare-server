import jwt from "jsonwebtoken";
import type { WithId } from "mongodb";
import type { UserDocument } from "../config/db.js";
import { env } from "../config/env.js";

export function generateToken(user: WithId<UserDocument>): string {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
    },
    env.jwtSecret,
    { algorithm: "HS256", expiresIn: "7d" },
  );
}

export const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
};
