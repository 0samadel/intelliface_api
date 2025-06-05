const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

dotenv.config();
const app = express();

// --- CORS CONFIGURATION ---
const corsOptions = {
  origin: [
    'http://localhost:60153', // Flutter Web (Dev)
    'http://localhost:5173',   // Common Flutter web port (Vite/WebDev)
    'https://intelliface-admin.web.app', // Example deployed frontend
    'https://intelliface-api.onrender.com', // Optional if needed for testing
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
};
app.use(cors(corsOptions));

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// --- ROUTES ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const locationRoutes = require('./routes/locationRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const todoRoutes = require('./routes/todo.routes');
const profileRoutes = require('./routes/profileRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/profile', profileRoutes);

// --- FACE ENROLLMENT ROUTE ---
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

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error("--- GLOBAL ERROR HANDLER CAUGHT ---");
  console.error("Error Name:", err.name);
  console.error("Error Message:", err.message);
  console.error("Error Stack:", err.stack);
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ success: false, message: `Invalid ID format for resource: ${err.path}` });
  }
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.',
  });
});

// --- DATABASE + SERVER START ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 5100;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// --- PROCESS ERRORS ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
