import "dotenv/config";

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing from .env file`);
  }
  return value;
};

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongodbUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  isProduction: process.env.NODE_ENV === "production",
};
