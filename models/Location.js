// ────────────────────────────────────────────────────────────────────────────────
// File    : models/Location.js
// Purpose : Mongoose schema for physical locations (e.g., offices or branches)
// Used in : locationController, departmentController, attendanceController
// ────────────────────────────────────────────────────────────────────────────────

/* ============================================================================
 * 1. Imports
 * ========================================================================== */
const mongoose = require('mongoose');

/* ============================================================================
 * 2. Schema Definition
 * ========================================================================== */
const locationSchema = new mongoose.Schema({
  // 🔹 Location name (e.g., "Head Office", "Branch A")
  name: {
    type: String,
    required: true,
    unique: true
  },

  // 🔹 Latitude (e.g., 24.7136)
  latitude: {
    type: Number,
    required: true
  },

  // 🔹 Longitude (e.g., 46.6753)
  longitude: {
    type: Number,
    required: true
  },

  // 🔹 Radius (in meters) used for attendance geofencing
  radius: {
    type: Number,
    required: true
  }

}, { timestamps: true }); // Adds createdAt and updatedAt automatically

/* ============================================================================
 * 3. Export Model
 * ========================================================================== */
module.exports = mongoose.model('Location', locationSchema);
/* ───────────────────────────────────────────────────────────────────────────── */
