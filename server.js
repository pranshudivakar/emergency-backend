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
  "https://emergency-frontend1.vercel.app",
  "https://project-0kehm.vercel.app",
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
      status: { type: String, default: "pending" }, // pending, accepted, rejected, no_hospitals
      primaryHospitalId: String,
      acceptedHospital: String,
      acceptedAt: Date,
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

/* ===== REGISTER ===== */

app.post("/api/auth/register", async (req, res) => {
  try {
    console.log("📝 ===== REGISTER REQUEST RECEIVED =====");
    console.log("Request Body:", JSON.stringify(req.body, null, 2));

    const exists = await User.findOne({ email: req.body.email });
    if (exists) {
      console.log("❌ User already exists:", req.body.email);
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const user = await User.create(req.body);
    console.log("✅ User created successfully!");
    console.log("User ID:", user._id);
    console.log("User Email:", user.email);
    console.log("User Name:", user.name);

    res.json({ success: true, user });
  } catch (error) {
    console.log("❌ REGISTER ERROR:", error.message);
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

/* ===== INIT HOSPITALS ===== */
app.post("/api/hospitals/init", async (req, res) => {
  try {
    const existingHospitals = await Hospital.find();
    if (existingHospitals.length > 0) {
      return res.json({
        success: true,
        message: `Hospitals already exist (${existingHospitals.length} hospitals found)`,
        count: existingHospitals.length,
      });
    }

    const defaultHospitals = [
      {
        name: "Fortis Hospital",
        email: "hospitalalerts4@gmail.com",
        latitude: 28.6212,
        longitude: 77.3796,
        phone: "+91-7524021510",
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
        email: "p46415053@gmail.com",
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
        email: "pranshupranshu92153@gmail.com",
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
        email: "pranshu.diwakar.739914@gmail.com",
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

    const result = await Hospital.insertMany(defaultHospitals);
    console.log(
      `✅ ${result.length} hospitals added successfully near Sector 63!`,
    );
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

/* ===== EMERGENCY ALERT WITH CONFIRMATION ===== */
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
    console.log("User:", name, phone);
    console.log("Location:", latitude, longitude);

    // Calculate and sort hospitals by distance
    const hospitals = await Hospital.find();
    const hospitalsWithDistance = hospitals.map((h) => ({
      ...h.toObject(),
      distance: getDistance(latitude, longitude, h.latitude, h.longitude),
    }));
    hospitalsWithDistance.sort((a, b) => a.distance - b.distance);

    // Sirf pehle hospital ko email bhejo
    const primaryHospital = hospitalsWithDistance[0];

    console.log(
      `🚑 Sending alert to primary hospital: ${primaryHospital.name} (${primaryHospital.distance.toFixed(2)} km)`,
    );

    const googleMapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

    // Create emergency record
    const emergency = await Emergency.create({
      userId,
      userName: name,
      userPhone: phone,
      userEmail: email,
      latitude,
      longitude,
      hospitalsNotified: [primaryHospital.name],
      googleMapsUrl,
      status: "pending",
      primaryHospitalId: primaryHospital._id,
    });

    const acceptUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/emergency/accept/${emergency._id}?hospitalId=${primaryHospital._id}`;
    const rejectUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/emergency/reject/${emergency._id}?hospitalId=${primaryHospital._id}`;

    // Send email with Accept/Reject buttons
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: primaryHospital.email,
      subject: `🚨 EMERGENCY - ${name || "Patient"} needs ambulance`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Emergency Alert</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; border: 2px solid #ff3333; border-radius: 10px; }
            .header { background: #ff3333; padding: 20px; text-align: center; color: white; }
            .content { padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; margin: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .accept { background: #4CAF50; color: white; }
            .reject { background: #f44336; color: white; }
            .info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🚨 EMERGENCY ALERT 🚨</h2>
            </div>
            <div class="content">
              <div class="info">
                <h3>👤 Patient Details:</h3>
                <p><strong>Name:</strong> ${name || "Not provided"}</p>
                <p><strong>Phone:</strong> <a href="tel:${phone}">${phone || "Not provided"}</a></p>
                <p><strong>Email:</strong> ${email || "Not provided"}</p>
                <p><strong>Distance:</strong> ${primaryHospital.distance.toFixed(2)} km</p>
                <p><strong>Location:</strong> ${latitude}, ${longitude}</p>
                <p><strong>Google Maps:</strong> <a href="${googleMapsUrl}" target="_blank">Click here</a></p>
              </div>
              <div style="text-align: center;">
                <a href="${acceptUrl}" class="button accept">✅ ACCEPT & Send Ambulance</a>
                <a href="${rejectUrl}" class="button reject">❌ REJECT</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`✅ Email sent to: ${primaryHospital.name}`);

    // Auto-forward after 5 minutes if no response
    setTimeout(async () => {
      const checkEmergency = await Emergency.findById(emergency._id);
      if (checkEmergency && checkEmergency.status === "pending") {
        console.log(
          `⏰ No response from ${primaryHospital.name}, forwarding...`,
        );

        // Find next hospital
        const nextHospital = hospitalsWithDistance.find(
          (h) => h._id.toString() !== primaryHospital._id,
        );

        if (nextHospital) {
          checkEmergency.hospitalsNotified.push(nextHospital.name);
          checkEmergency.primaryHospitalId = nextHospital._id;
          await checkEmergency.save();

          const newAcceptUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/emergency/accept/${checkEmergency._id}?hospitalId=${nextHospital._id}`;
          const newRejectUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/emergency/reject/${checkEmergency._id}?hospitalId=${nextHospital._id}`;

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: nextHospital.email,
            subject: `🚨 EMERGENCY - ${name || "Patient"} needs ambulance (Auto-forwarded)`,
            html: `
              <h2>🚨 Emergency Alert (Auto-Forwarded)</h2>
              <p><strong>Patient:</strong> ${name}</p>
              <p><strong>Phone:</strong> ${phone}</p>
              <p><strong>Distance:</strong> ${nextHospital.distance.toFixed(2)} km</p>
              <p><strong>Note:</strong> Previous hospital did not respond within 5 minutes.</p>
              <a href="${newAcceptUrl}" style="background: green; color: white; padding: 10px;">✅ ACCEPT</a>
              <a href="${newRejectUrl}" style="background: red; color: white; padding: 10px;">❌ REJECT</a>
            `,
          });
          console.log(`✅ Auto-forwarded to: ${nextHospital.name}`);
        } else {
          checkEmergency.status = "no_hospitals";
          await checkEmergency.save();
          console.log(`❌ No more hospitals available`);
        }
      }
    }, 300000); // 5 minutes

    res.json({
      success: true,
      message: `Alert sent to ${primaryHospital.name}. Waiting for confirmation.`,
      emergencyId: emergency._id,
      status: "pending",
      hospitalNotified: primaryHospital.name,
    });
  } catch (error) {
    console.log("❌ EMERGENCY ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Accept emergency route
app.post("/api/emergency/accept/:emergencyId", async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const { hospitalId } = req.query;

    console.log(`✅ Hospital ${hospitalId} ACCEPTED emergency ${emergencyId}`);

    const emergency = await Emergency.findById(emergencyId);
    if (!emergency) {
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>❌ Emergency Not Found</h2>
            <p>The emergency request does not exist.</p>
          </body>
        </html>
      `);
    }

    if (emergency.status !== "pending") {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>⚠️ Already Processed</h2>
            <p>This emergency has already been ${emergency.status}.</p>
          </body>
        </html>
      `);
    }

    // Update emergency status
    emergency.status = "accepted";
    emergency.acceptedHospital = hospitalId;
    emergency.acceptedAt = new Date();
    await emergency.save();

    console.log(
      `✅ Emergency ${emergencyId} accepted by hospital ${hospitalId}`,
    );

    // Get hospital details
    const hospital = await Hospital.findById(hospitalId);

    res.send(`
      <html>
        <head>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #e8f5e9; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .checkmark { font-size: 80px; color: #4CAF50; }
            .button { background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            .info { text-align: left; margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✅</div>
            <h2>Ambulance Dispatched!</h2>
            <div class="info">
              <p><strong>🏥 Hospital:</strong> ${hospital?.name || "Your hospital"}</p>
              <p><strong>👤 Patient Name:</strong> ${emergency.userName || "Patient"}</p>
              <p><strong>📞 Patient Phone:</strong> ${emergency.userPhone || "Not provided"}</p>
              <p><strong>📍 Location:</strong> ${emergency.latitude}, ${emergency.longitude}</p>
            </div>
            <p>🚑 Ambulance has been dispatched to the patient's location.</p>
            <p>Patient will be notified shortly.</p>
            <a href="${emergency.googleMapsUrl}" class="button" target="_blank">📍 Navigate to Patient</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.log("❌ Accept error:", error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>❌ Error Processing Request</h2>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
});

// Reject emergency route - forwards to next hospital
app.post("/api/emergency/reject/:emergencyId", async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const { hospitalId } = req.query;

    console.log(`❌ Hospital ${hospitalId} REJECTED emergency ${emergencyId}`);

    const emergency = await Emergency.findById(emergencyId);
    if (!emergency) {
      return res.status(404).send("Emergency not found");
    }

    if (emergency.status !== "pending") {
      return res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>⚠️ Already Processed</h2>
            <p>This emergency has already been ${emergency.status}.</p>
          </body>
        </html>
      `);
    }

    // Get all hospitals with distances
    const hospitals = await Hospital.find();
    const hospitalsWithDistance = hospitals.map((h) => ({
      ...h.toObject(),
      distance: getDistance(
        emergency.latitude,
        emergency.longitude,
        h.latitude,
        h.longitude,
      ),
    }));
    hospitalsWithDistance.sort((a, b) => a.distance - b.distance);

    // Find next hospital (not the one that rejected and not already notified)
    const notifiedHospitals = emergency.hospitalsNotified || [];
    const nextHospital = hospitalsWithDistance.find(
      (h) =>
        h._id.toString() !== hospitalId && !notifiedHospitals.includes(h.name),
    );

    if (nextHospital) {
      console.log(
        `🔄 Forwarding to next hospital: ${nextHospital.name} (${nextHospital.distance.toFixed(2)} km)`,
      );

      // Update emergency with new hospital
      emergency.hospitalsNotified.push(nextHospital.name);
      emergency.primaryHospitalId = nextHospital._id;
      await emergency.save();

      const acceptUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/emergency/accept/${emergency._id}?hospitalId=${nextHospital._id}`;
      const rejectUrl = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/emergency/reject/${emergency._id}?hospitalId=${nextHospital._id}`;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: nextHospital.email,
        subject: `🚨 EMERGENCY - ${emergency.userName || "Patient"} needs ambulance (Forwarded)`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Emergency Alert (Forwarded)</title>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; border: 2px solid #ff9800; border-radius: 10px; }
              .header { background: #ff9800; padding: 20px; text-align: center; color: white; }
              .content { padding: 20px; }
              .button { display: inline-block; padding: 12px 24px; margin: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }
              .accept { background: #4CAF50; color: white; }
              .reject { background: #f44336; color: white; }
              .info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .note { background: #fff3cd; padding: 10px; border-radius: 5px; color: #856404; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>🚨 EMERGENCY ALERT (Forwarded) 🚨</h2>
              </div>
              <div class="content">
                <div class="note">
                  <strong>⚠️ Note:</strong> Previous hospital could not respond to this emergency.
                </div>
                <div class="info">
                  <h3>👤 Patient Details:</h3>
                  <p><strong>Name:</strong> ${emergency.userName || "Not provided"}</p>
                  <p><strong>Phone:</strong> <a href="tel:${emergency.userPhone}">${emergency.userPhone || "Not provided"}</a></p>
                  <p><strong>Email:</strong> ${emergency.userEmail || "Not provided"}</p>
                  <p><strong>Distance from you:</strong> ${nextHospital.distance.toFixed(2)} km</p>
                  <p><strong>Location:</strong> ${emergency.latitude}, ${emergency.longitude}</p>
                  <p><strong>Google Maps:</strong> <a href="${emergency.googleMapsUrl}" target="_blank">Click here</a></p>
                </div>
                <div style="text-align: center;">
                  <a href="${acceptUrl}" class="button accept">✅ ACCEPT & Send Ambulance</a>
                  <a href="${rejectUrl}" class="button reject">❌ REJECT</a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>⚠️ Request Forwarded</h2>
            <p>Emergency has been forwarded to: <strong>${nextHospital.name}</strong></p>
            <p>Distance: ${nextHospital.distance.toFixed(2)} km</p>
          </body>
        </html>
      `);
    } else {
      // No more hospitals available
      emergency.status = "no_hospitals";
      await emergency.save();

      res.send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>⚠️ No Hospitals Available</h2>
            <p>All nearby hospitals are unable to respond.</p>
            <p>Please contact emergency services directly: <strong>108</strong></p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.log("❌ Reject error:", error);
    res.status(500).send("Error processing rejection");
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
      acceptedHospital: emergency.acceptedHospital,
      acceptedAt: emergency.acceptedAt,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ===== GET ALL EMERGENCIES ===== */
app.get("/api/emergency", async (req, res) => {
  const data = await Emergency.find().sort({ createdAt: -1 });
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

/* ===== AUTO INIT HOSPITALS ON START ===== */
const initHospitals = async () => {
  try {
    const count = await Hospital.countDocuments();
    if (count === 0) {
      console.log("📦 No hospitals found. Adding default hospitals...");

      const defaultHospitals = [
        {
          name: "Fortis Hospital",
          email: "hospitalalerts4@gmail.com",
          latitude: 28.6212,
          longitude: 77.3796,
          phone: "+91-7524021510",
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
          email: "p46415053@gmail.com",
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
          email: "pranshupranshu92153@gmail.com",
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
          email: "hospitalert4@gmail.com",
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

      await Hospital.insertMany(defaultHospitals);
      console.log(`✅ ${defaultHospitals.length} hospitals added to database!`);
    } else {
      console.log(`✅ ${count} hospitals already exist in database`);
    }
  } catch (error) {
    console.log("❌ Error initializing hospitals:", error.message);
  }
};

/* ===== SERVER ===== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initHospitals();
});
