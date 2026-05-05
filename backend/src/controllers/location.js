const locationService = require('../services/location');
const { catchAsync } = require('../utils/catchAsync');

class LocationController {
  // GET /api/locations/reverse?lat=X&lon=Y — tra cứu địa chỉ từ tọa độ
  getAddress = catchAsync(async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ status: 'error', message: 'Thiếu tham số lat hoặc lon' });
    }
    const result = await locationService.getAddressFromCoords(lat, lon);
    res.status(200).json({ status: 'success', data: result });
  });

  // GET /api/locations/forward?address=X — tra cứu tọa độ từ địa chỉ
  getCoords = catchAsync(async (req, res) => {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ status: 'error', message: 'Thiếu tham số address' });
    }
    const result = await locationService.getCoordsFromAddress(address);
    res.status(200).json({ status: 'success', data: result });
  });

  // GET /api/locations/search?text=X — tìm kiếm địa điểm tự động hoàn thành
  searchAutocomplete = catchAsync(async (req, res) => {
    const { text } = req.query;
    if (!text) {
      return res.status(400).json({ status: 'error', message: 'Thiếu tham số text' });
    }
    const result = await locationService.searchAutocomplete(text);
    res.status(200).json({ status: 'success', data: result });
  });
}

module.exports = new LocationController();
