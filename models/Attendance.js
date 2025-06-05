// intelliface_api/models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming you have a User model
    required: true
  },
  checkInTime: {
    type: Date,
    default: Date.now, // Or handle setting it in controller
    required: true
  },
  checkOutTime: {
    type: Date
  },
  location: { // From your attendanceController
    latitude: Number,
    longitude: Number
  },
  snapshotImage: { // From your attendanceController
    type: String
  },
  status: { // From your attendanceController and Attendance.js you provided earlier
    type: String,
    enum: ['Present', 'Late', 'Absent', 'On Leave'], // Add all possible statuses
    default: 'Present' // Or determine in controller
  }
  // Add any other fields relevant to an attendance record
}, { timestamps: true }); // Adds createdAt and updatedAt

// Optional: Indexes for performance
attendanceSchema.index({ userId: 1, checkInTime: -1 });

// Ensure the OverwriteModelError fix
module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);