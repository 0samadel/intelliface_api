const Department = require('../models/Department');

exports.createDepartment = async (req, res) => {
  try {
    const { name, location } = req.body;

    const department = new Department({ name, location });
    await department.save();

    const populated = await department.populate('location', 'name');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().populate('location', 'name');
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { name, location } = req.body;

    const updated = await Department.findByIdAndUpdate(
      req.params.id,
      { name, location },
      { new: true }
    ).populate('location', 'name');

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
