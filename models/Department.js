// ────────────────────────────────────────────────────────────────────────────────
// File    : models/Department.js
// Purpose : Mongoose schema for departments (e.g., HR, IT, Sales)
// Used in : departmentController, userController
// ────────────────────────────────────────────────────────────────────────────────

/* ============================================================================
 * 1. Imports
 * ========================================================================== */
const mongoose = require('mongoose');

/* ============================================================================
 * 2. Schema Definition
 * ========================================================================== */
const departmentSchema = new mongoose.Schema({
  // 🔹 Department name (e.g., 'HR', 'Engineering')
  name: {
    type: String,
    required: true,
    unique: true
  },

  // 🔹 Reference to the location (branch or office)
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  }

}, { timestamps: true }); // Adds `createdAt` and `updatedAt`

/* ============================================================================
 * 3. Export Model
 * ========================================================================== */
module.exports = mongoose.model('Department', departmentSchema);
/* ───────────────────────────────────────────────────────────────────────────── */
