import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function initDb() {
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'marmik');
  console.log('Connected to MongoDB');
}

function checkAdmin(req, res, next) {
  const pw = req.headers['x-admin-password'];
  if (pw && pw === process.env.ADMIN_PASSWORD) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function serializeDoc(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

// ---------- LOGIN ----------
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === process.env.ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Invalid password' });
});

// ---------- VIDEOS ----------
app.get('/api/videos', async (req, res) => {
  const docs = await db.collection('videos').find({}).toArray();
  res.json(docs.map(serializeDoc));
});

app.post('/api/videos', checkAdmin, async (req, res) => {
  const { title, type, url, startTime, duration, thumbnail } = req.body || {};
  if (!title || !type || !url) {
    return res.status(400).json({ ok: false, error: 'title, type, and url are required' });
  }
  const doc = {
    title,
    type,
    url,
    startTime: startTime || null,
    duration: duration || '',
    thumbnail: thumbnail || ''
  };
  const result = await db.collection('videos').insertOne(doc);
  res.json({ ok: true, id: result.insertedId.toString() });
});

app.delete('/api/videos/:id', checkAdmin, async (req, res) => {
  await db.collection('videos').deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ ok: true });
});

// ---------- PLAYLISTS ----------
app.get('/api/playlists', async (req, res) => {
  const docs = await db.collection('playlists').find({}).toArray();
  res.json(docs.map(serializeDoc));
});

app.post('/api/playlists', checkAdmin, async (req, res) => {
  const { name, videoIds } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
  const doc = { name, videoIds: videoIds || [] };
  const result = await db.collection('playlists').insertOne(doc);
  res.json({ ok: true, id: result.insertedId.toString() });
});

app.put('/api/playlists/:id', checkAdmin, async (req, res) => {
  const { name, videoIds } = req.body || {};
  await db.collection('playlists').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { name, videoIds } }
  );
  res.json({ ok: true });
});

app.delete('/api/playlists/:id', checkAdmin, async (req, res) => {
  await db.collection('playlists').deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(PORT, () => console.log(`Marmik Player API running on port ${PORT}`));
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
