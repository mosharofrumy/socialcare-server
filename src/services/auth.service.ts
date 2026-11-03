import bcrypt from "bcryptjs";
import { ObjectId, type WithId } from "mongodb";
import { usersCollection, type UserDocument } from "../config/db.js";
import type { AuthenticatedUser } from "../types/express/index.js";

export const emailOf = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const safeUser = (
  user: WithId<UserDocument>,
): AuthenticatedUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<WithId<UserDocument>> {
  const normalizedEmail = emailOf(email);
  const hashedPassword = await bcrypt.hash(password, 12);
  const newUser: UserDocument = {
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };
  const result = await usersCollection.insertOne(newUser);
  return { ...newUser, _id: result.insertedId };
}

export async function findUserByEmail(
  email: string,
): Promise<WithId<UserDocument> | null> {
  return usersCollection.findOne({ email: emailOf(email) });
}

export async function findUserById(
  id: string,
): Promise<WithId<UserDocument> | null> {
  return usersCollection.findOne(
    { _id: new ObjectId(id) },
    { projection: { password: 0 } },
  );
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
