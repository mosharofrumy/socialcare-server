import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Environment Variables ----------

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL =
  process.env.FRONTEND_URL || 'http://localhost:3000';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is missing from .env file');
}

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is missing from .env file');
}

// ---------- MongoDB Connection ----------

const client = new MongoClient(MONGODB_URI);

async function connectToMongoDB() {
  await client.connect();
  console.log('Successfully connected to MongoDB!');
}

const db = () => client.db('socialcare');

// ---------- Collections ----------

const usersCollection = () => db().collection('users');

const eventsCollection = () => db().collection('events');

const eventRegistrationsCollection = () =>
  db().collection('eventRegistrations');

// ---------- Database Indexes ----------

async function createIndexes() {
  await usersCollection().createIndex(
    { email: 1 },
    { unique: true }
  );

  await eventRegistrationsCollection().createIndex(
    { eventId: 1, 'user.email': 1 },
    { unique: true }
  );
}

// ---------- Middleware ----------

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json());
app.use(cookieParser());

// ---------- Helpers ----------

const emailOf = (value) =>
  String(value ?? '').trim().toLowerCase();

const safeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

// ---------- JWT Helper ----------

function generateToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1d' }
  );
}

// ---------- Cookie Options ----------

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
};

// ---------- Authentication Middleware ----------

function authenticateToken(req, res, next) {
  const authorizationHeader = req.get('authorization');
  let token;

  if (authorizationHeader) {
    const bearerMatch = authorizationHeader.match(/^Bearer\s+(\S+)$/i);

    if (!bearerMatch) {
      return res.status(401).json({
        message: 'Authorization header must use the Bearer scheme.',
      });
    }

    token = bearerMatch[1];
  } else {
    token = req.cookies?.token;
  }

  if (!token) {
    return res.status(401).json({
      message: 'Please login first.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      !/^[a-f\d]{24}$/i.test(decoded.sub) ||
      typeof decoded.email !== 'string' ||
      !decoded.email.trim() ||
      typeof decoded.name !== 'string' ||
      !decoded.name.trim()
    ) {
      return res.status(401).json({
        message: 'Invalid or expired token. Please login again.',
      });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired token. Please login again.',
    });
  }
}

// ---------- Event Constants ----------

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

// ---------- Date Helper ----------

const todayISO = () =>
  new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);

// ---------- Event Validation ----------

function validateEvent(body) {
  const {
    title,
    type,
    badge,
    date,
    thumbnailUrl,
    description,
  } = body ?? {};

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

  if (
    typeof description !== 'string' ||
    description.trim().length < 10
  ) {
    return 'Please add a short description (at least 10 characters).';
  }

  return null;
}

// ==================================================
// AUTHENTICATION APIs
// ==================================================

// ---------- POST /auth/register ----------

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};

    const normalizedEmail = emailOf(email);

    if (
      typeof name !== 'string' ||
      name.trim().length < 2
    ) {
      return res.status(400).json({
        message: 'Name must be at least 2 characters long.',
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: 'Please provide a valid email address.',
      });
    }

    if (
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long.',
      });
    }

    const existingUser = await usersCollection().findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      });
    }

    // Hash the password before saving it.
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    const result = await usersCollection().insertOne(newUser);

    const savedUser = {
      ...newUser,
      _id: result.insertedId,
    };

    // Generate JWT after successful registration.
    const token = generateToken(savedUser);

    res.cookie('token', token, cookieOptions);

    return res.status(201).json({
      message: 'Registration successful.',
      user: safeUser(savedUser),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      message: 'Something went wrong during registration.',
    });
  }
});

// ---------- POST /auth/login ----------

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    const normalizedEmail = emailOf(email);

    if (!normalizedEmail || typeof password !== 'string') {
      return res.status(400).json({
        message: 'Email and password are required.',
      });
    }

    const user = await usersCollection().findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    // Compare entered password with the stored hash.
    const isPasswordMatched = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordMatched) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);

    res.cookie('token', token, cookieOptions);

    return res.json({
      message: 'Login successful.',
      user: safeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Something went wrong during login.',
    });
  }
});

// ---------- POST /auth/logout ----------

app.post('/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return res.json({
    message: 'Logout successful.',
  });
});

// ---------- GET /auth/me ----------

app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await usersCollection().findOne(
      { _id: new ObjectId(req.user.id) },
      {
        projection: { password: 0 },
      }
    );

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    return res.json({
      user: safeUser(user),
    });
  } catch (error) {
    console.error('Get user error:', error);

    return res.status(500).json({
      message: 'Could not fetch user information.',
    });
  }
});

// ==================================================
// EVENTS APIs
// ==================================================

// ---------- GET /events ----------
// Get all events.

app.get('/events', async (req, res) => {
  try {
    const events = await eventsCollection()
      .find({})
      .sort({ date: 1, createdAt: 1 })
      .toArray();

    res.json(events);
  } catch (error) {
    console.error(error);

    res.status(500).send('Error fetching events');
  }
});

// ---------- GET /events/:id ----------
// Get single event.

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
  } catch (error) {
    console.error(error);

    res.status(500).send('Error fetching event');
  }
});

// ---------- POST /events ----------
// Create event. Login required.

app.post('/events', authenticateToken, async (req, res) => {
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
    } = req.body ?? {};

    const validationError = validateEvent({
      title,
      type,
      badge,
      date,
      thumbnailUrl,
      description,
    });

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
      location:
        typeof location === 'string' ? location.trim() : '',
      volunteersNeeded: Number(volunteersNeeded) || 0,

      // Organizer identity comes from the verified JWT.
      organizerName: req.user.name,
      organizerEmail: req.user.email,

      participants: [],
      createdAt: new Date().toISOString(),
    };

    const result = await eventsCollection().insertOne(event);

    res.status(201).json({
      message: 'Event published successfully',
      insertedId: result.insertedId,
      event,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send('Error creating event');
  }
});

// ---------- PUT /events/:id ----------
// Update event. Only the organizer can update.

app.put('/events/:id', authenticateToken, async (req, res) => {
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

    if (
      emailOf(req.user.email) !==
      emailOf(existing.organizerEmail)
    ) {
      return res.status(403).send(
        'Only the event organizer can update this event.'
      );
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
      location:
        typeof req.body.location === 'string'
          ? req.body.location.trim()
          : '',
      volunteersNeeded: Number(req.body.volunteersNeeded) || 0,
    };

    await eventsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    const updated = await eventsCollection().findOne({
      _id: new ObjectId(id),
    });

    res.json({
      message: 'Event updated successfully',
      event: updated,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send('Error updating event');
  }
});

// ---------- DELETE /events/:id ----------
// Delete event. Only the organizer can delete.

app.delete('/events/:id', authenticateToken, async (req, res) => {
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

    if (
      emailOf(req.user.email) !==
      emailOf(existing.organizerEmail)
    ) {
      return res.status(403).send(
        'Only the event organizer can delete this event.'
      );
    }

    const eventId = new ObjectId(id);

    await eventRegistrationsCollection().deleteMany({
      eventId,
    });

    const result = await eventsCollection().deleteOne({
      _id: eventId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send('Event not found');
    }

    res.json({
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error(error);

    res.status(500).send('Error deleting event');
  }
});

// ---------- POST /events/:id/join ----------
// Join event. Login required.

app.post(
  '/events/:id/join',
  authenticateToken,
  async (req, res) => {
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

      // Participant identity comes from the verified JWT.
      const email = emailOf(req.user.email);

      if (email === emailOf(existing.organizerEmail)) {
        return res.status(400).send(
          'Organizers cannot join their own event.'
        );
      }

      const eventId = new ObjectId(id);

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

      await eventsCollection().updateOne(
        { _id: eventId },
        { $addToSet: { participants: email } }
      );

      const updated = await eventsCollection().findOne({
        _id: eventId,
      });

      res.json({
        message: 'You have joined this event',
        participants: updated?.participants ?? [email],
      });
    } catch (error) {
      console.error(error);

      res.status(500).send('Error joining event');
    }
  }
);

// ---------- POST /events/:id/leave ----------
// Leave event. Login required.

app.post(
  '/events/:id/leave',
  authenticateToken,
  async (req, res) => {
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

      const email = emailOf(req.user.email);

      if (email === emailOf(existing.organizerEmail)) {
        return res.status(400).send(
          'Organizers cannot leave their own event — delete it instead.'
        );
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
        _id: eventId,
      });

      res.json({
        message: 'You have left this event',
        participants: updated?.participants ?? [],
      });
    } catch (error) {
      console.error(error);

      res.status(500).send('Error leaving event');
    }
  }
);

// ---------- 404 Handler ----------

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  });
});

// ---------- Start Server ----------

async function startServer() {
  try {
    await connectToMongoDB();
    await createIndexes();

    app.listen(PORT, () => {
      console.log(`Social Care server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

startServer();