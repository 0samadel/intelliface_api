const express = require('express');
const router = express.Router();
const {
  createEmployee,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');

// const { verifyAdmin } = require('../middleware/authMiddleware');

// Temporarily remove middleware for development
router.post('/employee', createEmployee);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
