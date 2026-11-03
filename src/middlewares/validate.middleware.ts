import type { RequestHandler } from "express";

const EVENT_TYPES = [
  "Donation Drive",
  "Health Campaign",
  "Education Support",
  "Plantation",
  "Child Care",
  "Clean-Up Drive",
  "Relief Support",
  "Emergency: Flood",
  "Emergency: Cyclone",
  "Emergency: Earthquake",
  "Emergency: Fire",
  "Blood Donation",
  "Food Distribution",
  "Elder Support",
  "Animal Welfare",
  "Winter Clothing Drive",
  "Women Empowerment",
  "Sports & Community",
];
const BADGES = ["New", "Urgent", "Featured", "Ongoing"];

function validateEvent(body: unknown): string | null {
  const event =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  const { title, type, badge, date, thumbnailUrl, description } = event;

  if (typeof title !== "string" || title.trim().length < 3) {
    return "Event title must be at least 3 characters long.";
  }
  if (typeof type !== "string" || !EVENT_TYPES.includes(type)) {
    return "Please choose a valid event type.";
  }
  if (typeof badge !== "string" || !BADGES.includes(badge)) {
    return "Please choose a valid event badge.";
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "Event date must be a valid date.";
  }

  const dateValue = new Date(`${date}T00:00:00Z`);
  if (
    Number.isNaN(dateValue.getTime()) ||
    dateValue.toISOString().slice(0, 10) !== date
  ) {
    return "Event date must be a valid date.";
  }

  const today = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 10);
  if (date < today) {
    return "Event date must be today or a future date, not a past date.";
  }
  if (
    typeof thumbnailUrl !== "string" ||
    !/^https?:\/\/\S+/.test(thumbnailUrl.trim())
  ) {
    return "Thumbnail image URL must be a valid URL.";
  }
  if (typeof description !== "string" || description.trim().length < 10) {
    return "Please add a short description (at least 10 characters).";
  }
  return null;
}

export const validateEventRequest: RequestHandler = (req, res, next) => {
  const error = validateEvent(req.body);
  if (error) {
    return res.status(400).send(error);
  }
  return next();
};
