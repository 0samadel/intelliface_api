// =============================================================================
// File: server.js
// Description: Initializes Express app, connects to MongoDB, sets up routes,
// middleware, CORS handling, error handling, and starts the server.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEPENDENCIES & SETUP
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

dotenv.config();

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// 2. CORS CONFIGURATION (DEBUG MODE)
// ─────────────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://intelliface-admin.web.app',    // your production frontend (Firebase or other)
  'https://intelliface-api.onrender.com', // allow self-origin calls if needed
  'http://localhost:62088',               // Flutter Web dev
  'http://127.0.0.1:62088',
];

const corsOptions = {
  origin: (origin, callback) => {
    console.log('🌐 Incoming Origin:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS Blocked:', origin);
      callback(new Error('CORS: Origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));


// ─────────────────────────────────────────────────────────────────────────────
// 3. MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

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
app.use('/api/faces', require('./routes/faceRoutes'));

// Optional: test route to communicate with face recognition service
app.post('/enroll_face', async (req, res) => {
  try {
    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64) {
      return res.status(400).json({ message: 'userId and imageBase64 are required.' });
    }

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
// 5. GLOBAL ERROR HANDLING
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
    process.exit(1);
  });

// ─────────────────────────────────────────────────────────────────────────────
// 7. SERVER START
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5100;
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PROCESS-LEVEL ERROR HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('🚨 Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  process.exit(1);
});
