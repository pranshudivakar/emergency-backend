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
  "https://emergency-frontend1.vercel.app", // ✅ Frontend URL
  "https://emergency-backend-8n80.onrender.com",
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
      emergency: String,
      rating: String,
      bedsAvailable: Number,
      ambulances: Number,
      image: String,
      distance: String,
      travelTime: String,
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

/* ===== INIT HOSPITALS - UPDATED WITH SECTOR 63 HOSPITALS ===== */
app.post("/api/hospitals/init", async (req, res) => {
  try {
    // First, check if hospitals already exist
    const existingHospitals = await Hospital.find();
    if (existingHospitals.length > 0) {
      return res.json({
        success: true,
        message: `Hospitals already exist (${existingHospitals.length} hospitals found)`,
        count: existingHospitals.length,
      });
    }

    // 5 Hospitals near Sector 63, Noida with front photos showing hospital names
    const defaultHospitals = [
      {
        name: "Fortis Hospital",
        email: "hospitalalerts4@gmail.com",
        latitude: 28.6212,
        longitude: 77.3796,
        phone: "+91-120-1234567",
        address: "Sector 62, Noida, Uttar Pradesh 201301",
        emergency: "24/7",
        rating: "4.8",
        bedsAvailable: 200,
        ambulances: 15,
        distance: "2.5 km",
        travelTime: "8 mins",
        image:
          "https://images.pexels.com/photos/236380/pexels-photo-236380.jpeg?w=500&h=300&fit=crop",
      },
      {
        name: "Max Super Speciality Hospital",
        email: "hospitalalerts4@gmail.com",
        latitude: 28.6457,
        longitude: 77.3179,
        phone: "+91-11-12345678",
        address: "Anand Vihar, Delhi - 110092",
        emergency: "24/7",
        rating: "4.7",
        bedsAvailable: 180,
        ambulances: 12,
        distance: "6.8 km",
        travelTime: "20 mins",
        image:
          "https://images.pexels.com/photos/3171567/pexels-photo-3171567.jpeg?w=500&h=300&fit=crop",
      },
      {
        name: "Kailash Hospital",
        email: "hospitalalerts4@gmail.com",
        latitude: 28.5997,
        longitude: 77.4012,
        phone: "+91-120-4567890",
        address: "Sector 71, Noida, Uttar Pradesh 201301",
        emergency: "24/7",
        rating: "4.5",
        bedsAvailable: 150,
        ambulances: 10,
        distance: "3.2 km",
        travelTime: "10 mins",
        image:
          "https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?w=500&h=300&fit=crop",
      },
      {
        name: "Metro Hospital & Heart Institute",
        email: "hospitalalerts4@gmail.com",
        latitude: 28.5856,
        longitude: 77.3181,
        phone: "+91-120-9876543",
        address: "Sector 12, Noida, Uttar Pradesh 201301",
        emergency: "24/7",
        rating: "4.6",
        bedsAvailable: 220,
        ambulances: 18,
        distance: "5.1 km",
        travelTime: "15 mins",
        image:
          "https://images.pexels.com/photos/4031815/pexels-photo-4031815.jpeg?w=500&h=300&fit=crop",
      },
      {
        name: "Yatharth Super Speciality Hospital",
        email: "hospitalalerts4@gmail.com",
        latitude: 28.5789,
        longitude: 77.4215,
        phone: "+91-120-7890123",
        address: "Sector 110, Noida, Uttar Pradesh 201304",
        emergency: "24/7",
        rating: "4.4",
        bedsAvailable: 300,
        ambulances: 20,
        distance: "4.5 km",
        travelTime: "12 mins",
        image:
          "https://images.pexels.com/photos/236477/pexels-photo-236477.jpeg?w=500&h=300&fit=crop",
      },
    ];

    // Insert all hospitals
    const result = await Hospital.insertMany(defaultHospitals);

    console.log(
      `✅ ${result.length} hospitals added successfully near Sector 63!`,
    );
    console.log("📍 Hospitals added:");
    result.forEach((h) => {
      console.log(`   - ${h.name}: ${h.address}`);
    });

    res.json({
      success: true,
      message: `${result.length} hospitals added successfully near Sector 63, Noida`,
      hospitals: result,
    });
  } catch (error) {
    console.log("❌ Error adding hospitals:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
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

/* ===== DELETE ALL HOSPITALS (FOR TESTING) ===== */
app.delete("/api/hospitals/clear", async (req, res) => {
  try {
    const result = await Hospital.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} hospitals`);
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} hospitals`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ===== SERVER ===== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
