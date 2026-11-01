import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';

const app = express();
const PORT = 5000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectClient = await connectToMongoDB();

// ---------- Collections ----------
const eventsCollection = () => connectClient.db('socialcare').collection('events');
const eventRegistrationsCollection = () =>
  connectClient.db('socialcare').collection('eventRegistrations');

await eventRegistrationsCollection().createIndex(
  { eventId: 1, 'user.email': 1 },
  { unique: true }
);

// ---------- Allowed values ----------
const EVENT_TYPES = [
  'Donation Drive',
  'Health Campaign',
  'Education Support',
  'Plantation',
  'Child Care',
  'Clean-Up Drive',
  'Relief Support',
  'Emergency: Flood',
  'Emergency: Cyclone',
  'Emergency: Earthquake',
  'Emergency: Fire',
  'Blood Donation',
  'Food Distribution',
  'Elder Support',
  'Animal Welfare',
  'Winter Clothing Drive',
  'Women Empowerment',
  'Sports & Community',
];

const BADGES = ['New', 'Urgent', 'Featured', 'Ongoing'];

// Local ISO date (YYYY-MM-DD) for "today".
const todayISO = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

// ---------- Helpers ----------
const emailOf = (value) => String(value ?? '').trim().toLowerCase();

/** Returns an error message string, or null when the payload is valid. */
function validateEvent(body) {
  const { title, type, badge, date, thumbnailUrl, description } = body ?? {};

  if (typeof title !== 'string' || title.trim().length < 3) {
    return 'Event title must be at least 3 characters long.';
  }

  if (!EVENT_TYPES.includes(type)) {
    return 'Please choose a valid event type.';
  }

  if (!BADGES.includes(badge)) {
    return 'Please choose a valid event badge.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    return 'Event date must be a valid date.';
  }

  if (date < todayISO()) {
    return 'Event date must be today or a future date, not a past date.';
  }

  if (
    typeof thumbnailUrl !== 'string' ||
    !/^https?:\/\/\S+/.test(thumbnailUrl.trim())
  ) {
    return 'Thumbnail image URL must be a valid URL.';
  }

  if (!description || description.trim().length < 10) {
    return 'Please add a short description (at least 10 characters).';
  }

  return null;
}

// ---------- Middleware ----------
// Simple CORS so the Next.js app (different port) can call this API.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());

// ---------- Events API ----------

// GET /events — all events, sorted by date (closest date first)
app.get('/events', async (req, res) => {
  try {
    const events = await eventsCollection()
      .find({})
      .sort({ date: 1, createdAt: 1 })
      .toArray();
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching events');
  }
});

// GET /events/:id — single event for the details page
app.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send('Invalid event id');
    }

    const event = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    if (!event) {
      return res.status(404).send('Event not found');
    }

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching event');
  }
});

// POST /events — create an event
app.post('/events', async (req, res) => {
  try {
    const {
      title,
      type,
      badge,
      date,
      thumbnailUrl,
      description,
      location,
      volunteersNeeded,
      organizerName,
      organizerEmail,
    } = req.body ?? {};

    const validationError = validateEvent({ title, type, badge, date, thumbnailUrl, description });
    if (validationError) {
      return res.status(400).send(validationError);
    }

    const event = {
      title: title.trim(),
      type,
      badge,
      date,
      thumbnailUrl: thumbnailUrl.trim(),
      description: description.trim(),
      location: location?.trim() || '',
      volunteersNeeded: Number(volunteersNeeded) || 0,
      organizerName: organizerName?.trim() || 'Social Care Team',
      organizerEmail: emailOf(organizerEmail),
      participants: [],
      createdAt: new Date().toISOString(),
    };

    const result = await eventsCollection().insertOne(event);

    res.status(201).json({
      message: 'Event published successfully',
      insertedId: result.insertedId,
      event,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating event');
  }
});

// PUT /events/:id — update an event (organizer only)
app.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send('Invalid event id');
    }

    const existing = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    if (!existing) {
      return res.status(404).send('Event not found');
    }

    // Only the organizer who published the event can update it.
    if (emailOf(req.body?.organizerEmail) !== emailOf(existing.organizerEmail)) {
      return res
        .status(403)
        .send('Only the event organizer can update this event.');
    }

    const validationError = validateEvent(req.body);
    if (validationError) {
      return res.status(400).send(validationError);
    }

    const updates = {
      title: req.body.title.trim(),
      type: req.body.type,
      badge: req.body.badge,
      date: req.body.date,
      thumbnailUrl: req.body.thumbnailUrl.trim(),
      description: req.body.description.trim(),
      location: req.body.location?.trim() || '',
      volunteersNeeded: Number(req.body.volunteersNeeded) || 0,
    };

    await eventsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    const updated = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    res.json({ message: 'Event updated successfully', event: updated });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating event');
  }
});

// DELETE /events/:id — delete an event (organizer only)
app.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send('Invalid event id');
    }

    const existing = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    if (!existing) {
      return res.status(404).send('Event not found');
    }

    // Only the organizer who published the event can delete it.
    if (emailOf(req.body?.organizerEmail) !== emailOf(existing.organizerEmail)) {
      return res
        .status(403)
        .send('Only the event organizer can delete this event.');
    }

    const eventId = new ObjectId(id);
    await eventRegistrationsCollection().deleteMany({ eventId });

    const result = await eventsCollection().deleteOne({ _id: eventId });

    if (result.deletedCount === 0) {
      return res.status(404).send('Event not found');
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting event');
  }
});

// POST /events/:id/join — join an event (organizer cannot join their own)
app.post('/events/:id/join', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send('Invalid event id');
    }

    const existing = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    if (!existing) {
      return res.status(404).send('Event not found');
    }

    const email = emailOf(req.body?.participantEmail);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res
        .status(400)
        .send('A signed-in user with a valid email is required to join.');
    }

    if (email && email === emailOf(existing.organizerEmail)) {
      return res
        .status(400)
        .send('Organizers cannot join their own event.');
    }

    const eventId = new ObjectId(id);
    try {
      await eventRegistrationsCollection().updateOne(
        { eventId, 'user.email': email },
        {
          $setOnInsert: {
            eventId,
            event: {
              title: existing.title,
              type: existing.type,
              badge: existing.badge,
              date: existing.date,
              thumbnailUrl: existing.thumbnailUrl,
              description: existing.description,
              location: existing.location,
              volunteersNeeded: existing.volunteersNeeded,
              organizerName: existing.organizerName,
              organizerEmail: existing.organizerEmail,
            },
            user: { email },
            joinedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    } catch (err) {
      if (err?.code !== 11000) {
        throw err;
      }
    }

    await eventsCollection().updateOne(
      { _id: eventId },
      { $addToSet: { participants: email } }
    );

    const updated = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    res.json({
      message: 'You have joined this event',
      participants: updated?.participants ?? [email],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error joining event');
  }
});

// POST /events/:id/leave — leave a previously joined event
app.post('/events/:id/leave', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send('Invalid event id');
    }

    const existing = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    if (!existing) {
      return res.status(404).send('Event not found');
    }

    const email = emailOf(req.body?.participantEmail);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res
        .status(400)
        .send('A signed-in user with a valid email is required to leave.');
    }

    if (email && email === emailOf(existing.organizerEmail)) {
      return res
        .status(400)
        .send('Organizers cannot leave their own event — delete it instead.');
    }

    const eventId = new ObjectId(id);
    await eventRegistrationsCollection().deleteOne({
      eventId,
      'user.email': email,
    });

    await eventsCollection().updateOne(
      { _id: eventId },
      { $pull: { participants: email } }
    );

    const updated = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    res.json({
      message: 'You have left this event',
      participants: updated?.participants ?? [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error leaving event');
  }
});

app.use((req, res) => {
  res.status(404).send('Route not found');
});

app.listen(PORT, () => {
  console.log(`Social Care server is running on port ${PORT}`);
});

// auth middleware
