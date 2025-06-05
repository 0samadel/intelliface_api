const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

dotenv.config();
const app = express();

// ✅ CORS fix for Flutter Web
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Body parsers and static files
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// --- Routes ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const locationRoutes = require('./routes/locationRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const todoRoutes = require('./routes/todo.routes');
const profileRoutes = require('./routes/profileRoutes');

// --- Mount routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/profile', profileRoutes);

// --- New route for face enrollment ---
app.post('/api/face/enroll', async (req, res) => {
  try {
    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64) {
      return res.status(400).json({ message: 'userId and imageBase64 are required.' });
    }

    const faceResponse = await axios.post('http://localhost:5001/enroll_face', {
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

// --- Global error handler ---
app.use((err, req, res, next) => {
  console.error("--- GLOBAL ERROR HANDLER ---");
  console.error("Error Name:", err.name);
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ success: false, message: `Invalid ID format: ${err.path}` });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// --- Start server ---
const PORT = process.env.PORT || 5100;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// --- Unhandled errors ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
