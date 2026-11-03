import { Router } from "express";
import {
  createEvent,
  deleteEventById,
  getEvent,
  getEvents,
  joinEventById,
  leaveEventById,
  updateEventById,
} from "../controllers/event.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { validateEventRequest } from "../middlewares/validate.middleware.js";

const router = Router();

router.get("/", getEvents);
router.get("/:id", getEvent);
router.post("/", authenticateToken, validateEventRequest, createEvent);
router.put("/:id", authenticateToken, validateEventRequest, updateEventById);
router.delete("/:id", authenticateToken, deleteEventById);
router.post("/:id/join", authenticateToken, joinEventById);
router.post("/:id/leave", authenticateToken, leaveEventById);

export default router;
