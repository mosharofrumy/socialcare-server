import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import {
  createEvent as insertEvent,
  deleteEvent,
  findEvent,
  joinEvent,
  leaveEvent,
  listEvents,
  updateEvent,
} from "../services/event.service.js";
import { emailOf } from "../services/auth.service.js";
import type { EventDocument } from "../config/db.js";

interface EventInput {
  title: string;
  type: string;
  badge: string;
  date: string;
  thumbnailUrl: string;
  description: string;
  location?: string;
  volunteersNeeded?: number | string;
}

type EventIdHandler = RequestHandler<{ id: string }>;

function isValidEventId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

export const getEvents: RequestHandler = async (_req, res) => {
  try {
    return res.json(await listEvents());
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error fetching events");
  }
};

export const getEvent: EventIdHandler = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidEventId(id)) {
      return res.status(400).send("Invalid event id");
    }
    const event = await findEvent(new ObjectId(id));
    if (!event) {
      return res.status(404).send("Event not found");
    }
    return res.json(event);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error fetching event");
  }
};

export const createEvent: RequestHandler = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Please login first." });
    }
    const body = req.body as EventInput;
    const event: EventDocument = {
      title: body.title.trim(),
      type: body.type,
      badge: body.badge,
      date: body.date,
      thumbnailUrl: body.thumbnailUrl.trim(),
      description: body.description.trim(),
      location: typeof body.location === "string" ? body.location.trim() : "",
      volunteersNeeded: Number(body.volunteersNeeded) || 0,
      organizerName: req.user.name,
      organizerEmail: req.user.email,
      participants: [],
      createdAt: new Date().toISOString(),
    };
    const insertedId = await insertEvent(event);
    return res.status(201).json({
      message: "Event published successfully",
      insertedId,
      event,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error creating event");
  }
};

export const updateEventById: EventIdHandler = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Please login first." });
    }
    const { id } = req.params;
    if (!isValidEventId(id)) {
      return res.status(400).send("Invalid event id");
    }
    const objectId = new ObjectId(id);
    const existing = await findEvent(objectId);
    if (!existing) {
      return res.status(404).send("Event not found");
    }
    if (emailOf(req.user.email) !== emailOf(existing.organizerEmail)) {
      return res
        .status(403)
        .send("Only the event organizer can update this event.");
    }

    const body = req.body as EventInput;
    const updates: Partial<EventDocument> = {
      title: body.title.trim(),
      type: body.type,
      badge: body.badge,
      date: body.date,
      thumbnailUrl: body.thumbnailUrl.trim(),
      description: body.description.trim(),
      location: typeof body.location === "string" ? body.location.trim() : "",
      volunteersNeeded: Number(body.volunteersNeeded) || 0,
    };
    const updated = await updateEvent(objectId, updates);
    return res.json({ message: "Event updated successfully", event: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error updating event");
  }
};

export const deleteEventById: EventIdHandler = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Please login first." });
    }
    const { id } = req.params;
    if (!isValidEventId(id)) {
      return res.status(400).send("Invalid event id");
    }
    const objectId = new ObjectId(id);
    const existing = await findEvent(objectId);
    if (!existing) {
      return res.status(404).send("Event not found");
    }
    if (emailOf(req.user.email) !== emailOf(existing.organizerEmail)) {
      return res
        .status(403)
        .send("Only the event organizer can delete this event.");
    }
    if (!(await deleteEvent(objectId))) {
      return res.status(404).send("Event not found");
    }
    return res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error deleting event");
  }
};

export const joinEventById: EventIdHandler = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Please login first." });
    }
    const { id } = req.params;
    if (!isValidEventId(id)) {
      return res.status(400).send("Invalid event id");
    }
    const eventId = new ObjectId(id);
    const existing = await findEvent(eventId);
    if (!existing) {
      return res.status(404).send("Event not found");
    }
    const email = emailOf(req.user.email);
    if (email === emailOf(existing.organizerEmail)) {
      return res.status(400).send("Organizers cannot join their own event.");
    }
    const updated = await joinEvent(eventId, existing, email);
    return res.json({
      message: "You have joined this event",
      participants: updated?.participants ?? [email],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error joining event");
  }
};

export const leaveEventById: EventIdHandler = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Please login first." });
    }
    const { id } = req.params;
    if (!isValidEventId(id)) {
      return res.status(400).send("Invalid event id");
    }
    const eventId = new ObjectId(id);
    const existing = await findEvent(eventId);
    if (!existing) {
      return res.status(404).send("Event not found");
    }
    const email = emailOf(req.user.email);
    if (email === emailOf(existing.organizerEmail)) {
      return res
        .status(400)
        .send("Organizers cannot leave their own event — delete it instead.");
    }
    const updated = await leaveEvent(eventId, email);
    return res.json({
      message: "You have left this event",
      participants: updated?.participants ?? [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error leaving event");
  }
};
