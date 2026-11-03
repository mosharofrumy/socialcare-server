import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { env } from "../config/env.js";

export const authenticateToken: RequestHandler = (req, res, next) => {
  const authorizationHeader = req.get("authorization");
  let token: string | undefined;

  if (authorizationHeader) {
    const bearerMatch = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
    if (!bearerMatch) {
      return res.status(401).json({
        message: "Authorization header must use the ******",
      });
    }
    token = bearerMatch[1];
  } else {
    token = req.cookies?.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Please login first." });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
    });

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      !ObjectId.isValid(decoded.sub) ||
      typeof decoded.email !== "string" ||
      !decoded.email.trim() ||
      typeof decoded.name !== "string" ||
      !decoded.name.trim()
    ) {
      return res.status(401).json({
        message: "Invalid or expired token. Please login again.",
      });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    };
    return next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token. Please login again.",
    });
  }
};
