// =============================================================================
// File: server.js (Main Entry Point)
// Description: Initializes the Express app, connects to MongoDB, sets up routes,
// CORS, middleware, error handling, and launches the server.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEPENDENCIES & SETUP
// ─────────────────────────────────────────────────────────────────────────────
const express    = require('express');
const mongoose   = require('mongoose');
const dotenv     = require('dotenv');
const cors       = require('cors');
const path       = require('path');
const axios      = require('axios');

dotenv.config(); // Load environment variables from .env file

const app = express(); // Initialize Express app


// ─────────────────────────────────────────────────────────────────────────────
// 2. CORS CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

// Define allowed origins (frontend URLs)
const allowedOrigins = [
  'https://intelliface.vercel.app', // ✅ Vercel deployment
  'https://intelliface-admin.web.app',    // Optional: Firebase
  'http://localhost:3000',                // Local frontend
  'http://localhost:5000',                // Local dev API use
];

const corsOptions = {
  origin: (origin, callback) => {
    console.log('🌐 Incoming Request Origin:', origin);

    // 1. Allow requests with no origin (e.g., Postman, mobile apps)
    if (!origin) {
      console.log('✅ CORS Allowed: No origin (e.g., Postman)');
      return callback(null, true);
    }

    // 2. Allow whitelisted origins
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS Allowed:', origin);
      return callback(null, true);
    }

    // 3. Block everything else
    console.log('❌ CORS Blocked:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle pre-flight requests with the same options

// ─────────────────────────────────────────────────────────────────────────────
// 3. MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded data
app.use('/uploads', express.static(path.join(__dirname, 'Uploads'))); // Serve static files

// ─────────────────────────────────────────────────────────────────────────────
// 4. ROUTES
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/todos', require('./routes/todo.routes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/faces', require('./routes/faceRoutes')); // Face enroll & verify

// Optional route for testing direct communication with Python face service
app.post('/enroll_face', async (req, res) => {
  try {
    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64)
      return res.status(400).json({ message: 'userId and imageBase64 are required.' });

    const faceResponse = await axios.post('http://localhost:5001/generate-embedding', {
      employee_id: userId,
      image_base64: imageBase64,
    });

    res.status(faceResponse.status).json(faceResponse.data);
  } catch (err) {
    console.error('Face enrollment error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      message: err.response?.data?.error || 'Face enrollment failed.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GLOBAL ERROR HANDLING MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("\n--- GLOBAL ERROR HANDLER ---");
  console.error("Name:", err.name);
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ success: false, message: `Invalid ID format: ${err.path}` });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DATABASE CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected...'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1); // Exit app on DB connection failure
  });

// ─────────────────────────────────────────────────────────────────────────────
// 7. START THE SERVER
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5100;
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PROCESS-LEVEL ERROR HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  process.exit(1);
});
/* ───────────────────────────────────────────────────────────────────────────── */
