const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location');

// Định nghĩa các route địa chỉ
router.get('/reverse', locationController.getAddress);
router.get('/forward', locationController.getCoords);
router.get('/search', locationController.searchAutocomplete);

module.exports = router;
