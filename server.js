require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();

// ===== CORS SETUP =====
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://your-frontend-url.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = "CORS policy does not allow access from this origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);
app.use(express.json());

/* ===== DATABASE CONNECTION ===== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

/* ===== MODELS ===== */

const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      name: { type: String, required: true },
      email: { type: String, unique: true, required: true },
      password: { type: String, required: true },
      phone: { type: String, required: true },
      age: String,
      gender: String,
      bloodGroup: String,
      allergies: String,
      disease: String,
      medication: String,
      emergencyName: String,
      emergencyPhone: String,
      relationship: String,
    },
    { timestamps: true },
  ),
);

const Hospital = mongoose.model(
  "Hospital",
  new mongoose.Schema(
    {
      name: String,
      email: String,
      latitude: Number,
      longitude: Number,
      phone: String,
      address: String,
    },
    { timestamps: true },
  ),
);

const Emergency = mongoose.model(
  "Emergency",
  new mongoose.Schema(
    {
      userId: String,
      userName: String,
      userPhone: String,
      userEmail: String,
      latitude: Number,
      longitude: Number,
      hospitalsNotified: [String],
      googleMapsUrl: String,
      status: { type: String, default: "pending" },
    },
    { timestamps: true },
  ),
);

/* ===== EMAIL CONFIG ===== */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err) => {
  if (err) console.log("❌ Email Server Error:", err);
  else console.log("✅ Email Server Ready");
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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ===== REGISTER (WITH DEBUG LOGS) ===== */

app.post("/api/auth/register", async (req, res) => {
  try {
    console.log("📝 ===== REGISTER REQUEST RECEIVED =====");
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    // Check if user exists
    const exists = await User.findOne({ email: req.body.email });
    if (exists) {
      console.log("❌ User already exists:", req.body.email);
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Create user
    const user = await User.create(req.body);
    console.log("✅ User created successfully!");
    console.log("User ID:", user._id);
    console.log("User Email:", user.email);
    console.log("User Name:", user.name);

    res.json({ success: true, user });
  } catch (error) {
    console.log("❌ REGISTER ERROR:", error.message);
    console.log("Error Details:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
});

/* ===== LOGIN ===== */

app.post("/api/auth/login", async (req, res) => {
  try {
    console.log("📝 ===== LOGIN REQUEST RECEIVED =====");
    console.log("Email:", req.body.email);

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("✅ User found:", user.name);
    res.json({
      success: true,
      user,
      token: "dummy-token",
    });
  } catch (error) {
    console.log("❌ LOGIN ERROR:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ===== ADD HOSPITAL ===== */

app.post("/api/hospital/add", async (req, res) => {
  try {
    const hospital = await Hospital.create(req.body);
    console.log("✅ Hospital added:", hospital.name);
    res.json({
      success: true,
      message: "Hospital Added",
      hospital,
    });
  } catch (error) {
    console.log("❌ Hospital Add Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ===== GET HOSPITALS ===== */

app.get("/api/hospitals", async (req, res) => {
  const hospitals = await Hospital.find();
  console.log("📋 Hospitals fetched:", hospitals.length);
  res.json({
    success: true,
    hospitals,
  });
});

/* ===== EMERGENCY ALERT ===== */

app.post("/api/emergency", async (req, res) => {
  try {
    const { latitude, longitude, userId, name, phone, email } = req.body;

    if (!userId) {
      console.log("❌ No userId provided");
      return res
        .status(400)
        .json({ success: false, message: "UserId required" });
    }

    console.log("🚨 ===== EMERGENCY TRIGGERED =====");
    console.log("User ID:", userId);
    console.log("User Name:", name);
    console.log("User Phone:", phone);
    console.log("Location:", latitude, longitude);

    const googleMapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    const hospitals = await Hospital.find();

    const nearbyHospitals = hospitals.filter((h) => {
      const distance = getDistance(
        latitude,
        longitude,
        h.latitude,
        h.longitude,
      );
      console.log(`Distance to ${h.name}:`, distance.toFixed(2), "km");
      return distance <= 50;
    });

    const notifiedNames = nearbyHospitals.map((h) => h.name);
    console.log("Nearby hospitals:", notifiedNames.length);

    /* ===== SEND EMAIL TO HOSPITALS ===== */
    for (const hospital of nearbyHospitals) {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Emergency Alert</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; border: 2px solid #ff3333; border-radius: 10px; overflow: hidden; }
              .header { background: #ff3333; padding: 20px; text-align: center; color: white; }
              .content { padding: 20px; }
              .patient-details { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .patient-details h3 { margin: 0 0 10px 0; color: #ff3333; }
              .detail-row { margin: 8px 0; }
              .detail-label { font-weight: bold; display: inline-block; width: 100px; }
              .location { background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; }
              .map-btn { background: #4285F4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
              .footer { background: #333; padding: 15px; text-align: center; color: white; font-size: 12px; }
              .emergency-badge { font-size: 24px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="emergency-badge">🚨 EMERGENCY ALERT 🚨</div>
                <p>Immediate Action Required</p>
              </div>
              <div class="content">
                <div class="patient-details">
                  <h3>👤 Patient Details:</h3>
                  <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <strong>${name || "Not provided"}</strong>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <a href="tel:${phone}" style="color: #ff3333;">${phone || "Not provided"}</a>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    ${email || "Not provided"}
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">User ID:</span>
                    ${userId}
                  </div>
                </div>
                <div class="location">
                  <h3>📍 Location Details:</h3>
                  <p><strong>Latitude:</strong> ${latitude}</p>
                  <p><strong>Longitude:</strong> ${longitude}</p>
                  <a href="${googleMapsUrl}" class="map-btn" target="_blank">
                    📍 Open in Google Maps
                  </a>
                </div>
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <h3 style="color: #856404;">⚠️ Action Required:</h3>
                  <ul>
                    <li>📞 Call patient immediately: <strong>${phone || "No phone available"}</strong></li>
                    <li>🚑 Dispatch ambulance to location</li>
                    <li>🩺 Prepare emergency services</li>
                    <li>⏱️ Respond within 5 minutes</li>
                  </ul>
                </div>
              </div>
              <div class="footer">
                <p>🚑 Smart Emergency Healthcare System</p>
                <p>This is an automated emergency alert. Please respond immediately.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: hospital.email,
          subject: `🚨 EMERGENCY ALERT - ${name || "Patient"} needs help`,
          html: emailHtml,
          text: `🚨 EMERGENCY ALERT\n\nPATIENT DETAILS:\nName: ${name}\nPhone: ${phone}\nLocation: ${latitude}, ${longitude}\nMap: ${googleMapsUrl}`,
        });

        console.log("✅ Email sent to:", hospital.email);
      } catch (mailError) {
        console.log("❌ Email Error for", hospital.email, mailError.message);
      }
    }

    const emergency = await Emergency.create({
      userId,
      userName: name,
      userPhone: phone,
      userEmail: email,
      latitude,
      longitude,
      hospitalsNotified: notifiedNames,
      googleMapsUrl,
      status: "sent",
    });

    console.log("✅ Emergency saved:", emergency._id);

    res.json({
      success: true,
      message: "Emergency sent successfully",
      googleMapsUrl,
      userId,
      userName: name,
      userPhone: phone,
      emergencyId: emergency._id,
      hospitalsNotified: notifiedNames.length ? notifiedNames : ["None"],
    });
  } catch (error) {
    console.log("❌ EMERGENCY ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

/* ===== GET EMERGENCY STATUS ===== */
app.get("/api/emergency/status/:emergencyId", async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.emergencyId);
    if (!emergency) {
      return res
        .status(404)
        .json({ success: false, message: "Emergency not found" });
    }
    res.json({
      success: true,
      status: emergency.status,
      userName: emergency.userName,
      userPhone: emergency.userPhone,
      hospitalsNotified: emergency.hospitalsNotified,
      createdAt: emergency.createdAt,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ===== GET ALL EMERGENCIES ===== */
app.get("/api/emergency", async (req, res) => {
  const data = await Emergency.find();
  res.json({
    success: true,
    data,
  });
});

/* ===== SERVER ===== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
