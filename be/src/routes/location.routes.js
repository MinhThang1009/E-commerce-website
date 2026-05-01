const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// Define location routes
router.get('/reverse', locationController.getAddress);
router.get('/forward', locationController.getCoords);
router.get('/search', locationController.searchAutocomplete);

module.exports = router;
