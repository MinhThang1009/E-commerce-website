const locationService = require('../services/locationService');
const { catchAsync } = require('../utils/catchAsync');

class LocationController {
  // GET /api/location/reverse?lat=X&lon=Y
  getAddress = catchAsync(async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ status: 'error', message: 'Missing lat or lon parameters' });
    }
    const result = await locationService.getAddressFromCoords(lat, lon);
    res.status(200).json({ status: 'success', data: result });
  });

  // GET /api/location/forward?address=X
  getCoords = catchAsync(async (req, res) => {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ status: 'error', message: 'Missing address parameter' });
    }
    const result = await locationService.getCoordsFromAddress(address);
    res.status(200).json({ status: 'success', data: result });
  });

  // GET /api/location/search?text=X
  searchAutocomplete = catchAsync(async (req, res) => {
    const { text } = req.query;
    if (!text) {
      return res.status(400).json({ status: 'error', message: 'Missing text parameter' });
    }
    const result = await locationService.searchAutocomplete(text);
    res.status(200).json({ status: 'success', data: result });
  });
}

module.exports = new LocationController();
