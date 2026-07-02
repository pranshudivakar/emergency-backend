require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();

/* ===== ROOT ROUTE (FIX FOR "Cannot GET /") ===== */
app.get("/", (req, res) => {
  res.send("🚀 Emergency Healthcare Backend is Running");
});

/* ===== HEALTH CHECK ROUTE ===== */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend is live",
  });
});

/* ===== CORS ===== */
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://localhost:5179",
  "http://localhost:5180",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error("CORS not allowed"), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

/* ===== MONGODB CONNECTION ===== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

/* ===== MODELS ===== */
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    phone: String,
  }),
);

const Hospital = mongoose.model(
  "Hospital",
  new mongoose.Schema({
    name: String,
    email: String,
    latitude: Number,
    longitude: Number,
    phone: String,
    address: String,
    rating: String,
    bedsAvailable: Number,
    ambulances: Number,
  }),
);

const Emergency = mongoose.model(
  "Emergency",
  new mongoose.Schema({
    userId: String,
    userName: String,
    userPhone: String,
    userEmail: String,
    latitude: Number,
    longitude: Number,
    status: { type: String, default: "pending" },
    hospitalsNotified: [String],
    rejectedHospitals: [String],
    acceptedHospital: String,
    acceptedAt: Date,
    googleMapsUrl: String,
  }),
);

/* ===== EMAIL ===== */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ===== DISTANCE FUNCTION ===== */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/* ===== REGISTER ===== */
app.post("/api/auth/register", async (req, res) => {
  try {
    const exists = await User.findOne({ email: req.body.email });
    if (exists)
      return res.status(400).json({ success: false, message: "User exists" });

    const user = await User.create(req.body);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ===== LOGIN ===== */
app.post("/api/auth/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user)
      return res.status(400).json({ success: false, message: "Not found" });

    res.json({ success: true, user, token: "dummy" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ===== HOSPITALS ===== */
app.get("/api/hospitals", async (req, res) => {
  const hospitals = await Hospital.find();
  res.json({ success: true, hospitals });
});

/* ===== EMERGENCY ===== */
app.post("/api/emergency", async (req, res) => {
  try {
    const { latitude, longitude, userId, name, phone, email } = req.body;

    const hospitals = await Hospital.find();

    const sorted = hospitals
      .map((h) => ({
        ...h.toObject(),
        distance: getDistance(latitude, longitude, h.latitude, h.longitude),
      }))
      .sort((a, b) => a.distance - b.distance);

    const hospital = sorted[0];

    const emergency = await Emergency.create({
      userId,
      userName: name,
      userPhone: phone,
      userEmail: email,
      latitude,
      longitude,
      hospitalsNotified: [hospital.name],
      googleMapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
    });

    res.json({
      success: true,
      message: "Emergency sent",
      emergencyId: emergency._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ===== INIT HOSPITALS ===== */
const initHospitals = async () => {
  const count = await Hospital.countDocuments();
  if (count === 0) {
    await Hospital.insertMany([
      {
        name: "Fortis Hospital",
        email: "hospitalalerts4@gmail.com",
        latitude: 28.6212,
        longitude: 77.3796,
        phone: "+91-1111111111",
        address: "Noida",
        rating: "4.8",
        bedsAvailable: 200,
        ambulances: 15,
      },
    ]);

    console.log("🏥 Default hospitals added");
  }
};

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initHospitals();
});
