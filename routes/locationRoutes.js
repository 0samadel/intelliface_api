const express = require('express');
const router = express.Router();
const {
  createLocation,
  getLocations,
  updateLocation,
  deleteLocation
} = require('../controllers/locationController');

// const { verifyAdmin } = require('../middleware/authMiddleware');

// Temporarily remove middleware for development
router.post('/', createLocation);
router.get('/', getLocations);
router.put('/:id', updateLocation);
router.delete('/:id', deleteLocation);

module.exports = router;
