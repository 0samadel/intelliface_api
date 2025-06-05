// intelliface_api/models/Todo.model.js
const mongoose = require('mongoose');

const TodoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Refers to the 'User' model
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  dueDate: {
    type: Date,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

// Indexes for better query performance
TodoSchema.index({ user: 1, dueDate: 1 });
TodoSchema.index({ user: 1, isCompleted: 1, createdAt: -1 });

module.exports = mongoose.models.Todo || mongoose.model('Todo', TodoSchema);