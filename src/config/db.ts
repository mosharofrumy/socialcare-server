import { MongoClient, type Collection, type ObjectId } from "mongodb";
import { env } from "./env.js";

export interface UserDocument {
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

export interface EventDocument {
  title: string;
  type: string;
  badge: string;
  date: string;
  thumbnailUrl: string;
  description: string;
  location: string;
  volunteersNeeded: number;
  organizerName: string;
  organizerEmail: string;
  participants: string[];
  createdAt: string;
}

export interface EventRegistrationDocument {
  eventId: ObjectId;
  event: Omit<EventDocument, "participants" | "createdAt">;
  user: { email: string };
  joinedAt: string;
}

const client = new MongoClient(env.mongodbUri);
const database = client.db("socialcare");

export const usersCollection: Collection<UserDocument> =
  database.collection("users");
export const eventsCollection: Collection<EventDocument> =
  database.collection("events");
export const eventRegistrationsCollection: Collection<EventRegistrationDocument> =
  database.collection("eventRegistrations");

export async function connectToMongoDB(): Promise<void> {
  await client.connect();
  console.log("Successfully connected to MongoDB!");

  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await eventRegistrationsCollection.createIndex(
    { eventId: 1, "user.email": 1 },
    { unique: true },
  );
}

export async function closeMongoDB(): Promise<void> {
  await client.close();
}
