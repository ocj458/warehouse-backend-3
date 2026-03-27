const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// SERVE FRONTEND
app.use(express.static(path.join(__dirname, 'public')));

/* ================= DATABASE CONNECT ================= */
// Use MONGO_URI from environment variables for Render
// Fallback to localhost for local development
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/';

mongoose.connect(mongoURI, {
  serverSelectionTimeoutMS: 30000 // 30s timeout
})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1); // Exit if DB connection fails
  });

/* ================= MODELS ================= */
const User = mongoose.model('User', {
  username: String,
  password: String,
  role: { type: String, default: "staff" }
});

const Item = mongoose.model('Item', {
  name: String,
  qty: Number
});

/* ================= CREATE ADMIN ================= */
async function createAdmin() {
  const admin = await User.findOne({ username: "Admin" });

  if (!admin) {
    const hashed = await bcrypt.hash("admin12345", 10);
    await User.create({ username: "Admin", password: hashed, role: "admin" });
    console.log("🔥 Admin Created: Admin / admin12345");
  }
}
createAdmin();

/* ================= LOGIN ================= */
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ status: "fail" });

    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.json({ status: "success", role: user.role });
    } else {
      res.status(401).json({ status: "fail" });
    }
  } catch {
    res.status(500).json({ status: "error" });
  }
});

/* ================= USERS ================= */
app.post('/create-user', async (req, res) => {
  try {
    const { username, password } = req.body;
    const exist = await User.findOne({ username });
    if (exist) return res.send("User exists");

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashed });
    res.send("User created");
  } catch {
    res.status(500).send("Error");
  }
});

app.get('/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.delete('/delete-user/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user.role === "admin") return res.send("Cannot delete admin");

  await User.findByIdAndDelete(req.params.id);
  res.send("Deleted");
});

/* ================= INVENTORY ================= */
app.post('/add-item', async (req, res) => {
  const { name, qty } = req.body;
  await Item.create({ name, qty });
  res.send("Added");
});

app.get('/items', async (req, res) => {
  const items = await Item.find();
  res.json(items);
});

app.delete('/delete-item/:id', async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.send("Deleted");
});

// NEW: UPDATE ITEM QUANTITY (+ / -)
app.patch('/update-item', async (req, res) => {
  try {
    const { id, change } = req.body;
    const item = await Item.findById(id);
    if (!item) return res.status(404).send("Item not found");

    let newQty = item.qty + change;
    if (newQty < 0) newQty = 0;

    item.qty = newQty;
    await item.save();
    res.send("Updated");
  } catch (err) {
    res.status(500).send("Error updating item");
  }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
