const User = require('../models/User');
const bcrypt = require('bcryptjs');

// 📌 CREATE employee with auto-generated employeeId
exports.createEmployee = async (req, res) => {
  try {
    const { fullName, phone, email, username, password, address, department } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const count = await User.countDocuments({ role: 'employee' });
    const employeeId = `EMP${(count + 1).toString().padStart(3, '0')}`;

    const user = new User({
      employeeId,
      fullName,
      phone,
      email,
      username,
      password: hashedPassword,
      address,
      role: 'employee',
      department
    });

    await user.save();
    const populated = await user.populate('department', 'name');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 📌 GET all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').populate('department', 'name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 📌 GET user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('department', 'name');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 📌 UPDATE user
exports.updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true
    }).select('-password').populate('department', 'name');

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 📌 DELETE user
exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
