import { ObjectId, type WithId } from "mongodb";
import {
  eventRegistrationsCollection,
  eventsCollection,
  type EventDocument,
  type EventRegistrationDocument,
} from "../config/db.js";

export async function listEvents(): Promise<WithId<EventDocument>[]> {
  return eventsCollection.find({}).sort({ date: 1, createdAt: 1 }).toArray();
}

export async function findEvent(
  id: ObjectId,
): Promise<WithId<EventDocument> | null> {
  return eventsCollection.findOne({ _id: id });
}

export async function createEvent(
  event: EventDocument,
): Promise<ObjectId> {
  const result = await eventsCollection.insertOne(event);
  return result.insertedId;
}

export async function updateEvent(
  id: ObjectId,
  updates: Partial<EventDocument>,
): Promise<WithId<EventDocument> | null> {
  await eventsCollection.updateOne({ _id: id }, { $set: updates });
  return findEvent(id);
}

export async function deleteEvent(id: ObjectId): Promise<boolean> {
  await eventRegistrationsCollection.deleteMany({ eventId: id });
  const result = await eventsCollection.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

export async function joinEvent(
  eventId: ObjectId,
  event: WithId<EventDocument>,
  email: string,
): Promise<WithId<EventDocument> | null> {
  const registration: EventRegistrationDocument = {
    eventId,
    event: {
      title: event.title,
      type: event.type,
      badge: event.badge,
      date: event.date,
      thumbnailUrl: event.thumbnailUrl,
      description: event.description,
      location: event.location,
      volunteersNeeded: event.volunteersNeeded,
      organizerName: event.organizerName,
      organizerEmail: event.organizerEmail,
    },
    user: { email },
    joinedAt: new Date().toISOString(),
  };
  await eventRegistrationsCollection.updateOne(
    { eventId, "user.email": email },
    { $setOnInsert: registration },
    { upsert: true },
  );
  await eventsCollection.updateOne(
    { _id: eventId },
    { $addToSet: { participants: email } },
  );
  return findEvent(eventId);
}

export async function leaveEvent(
  eventId: ObjectId,
  email: string,
): Promise<WithId<EventDocument> | null> {
  await eventRegistrationsCollection.deleteOne({
    eventId,
    "user.email": email,
  });
  await eventsCollection.updateOne(
    { _id: eventId },
    { $pull: { participants: email } },
  );
  return findEvent(eventId);
}
