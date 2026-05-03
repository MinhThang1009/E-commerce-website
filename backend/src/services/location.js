const logger = require('../../utils/logger');
const axios = require('axios');

class LocationService {
  constructor() {
    this.token = process.env.LOCATION_IQ_TOKEN;
    this.baseUrl = 'https://us1.locationiq.com/v1';
  }

  // 1. Geocoding ngược: getAddressFromCoords(lat, lon)
  async getAddressFromCoords(lat, lon) {
    try {
      if (!this.token) throw new Error('LOCATION_IQ_TOKEN chưa được cấu hình trong .env');

      const response = await axios.get(`${this.baseUrl}/reverse.php`, {
        params: {
          key: this.token,
          lat: lat,
          lon: lon,
          format: 'json',
        },
      });
      return response.data;
    } catch (error) {
      logger.error('Lỗi trong getAddressFromCoords:', error.message);
      return { error: 'Không thể lấy địa chỉ' };
    }
  }

  // 2. Geocoding xuôi: getCoordsFromAddress(address)
  async getCoordsFromAddress(address) {
    try {
      if (!this.token) throw new Error('LOCATION_IQ_TOKEN chưa được cấu hình trong .env');

      const response = await axios.get(`${this.baseUrl}/search.php`, {
        params: {
          key: this.token,
          q: address,
          format: 'json',
          limit: 1,
        },
      });
      return response.data;
    } catch (error) {
      logger.error('Lỗi trong getCoordsFromAddress:', error.message);
      return [];
    }
  }

  // 3. Gợi ý tự động: searchAutocomplete(text)
  async searchAutocomplete(text) {
    try {
      if (!this.token) throw new Error('LOCATION_IQ_TOKEN chưa được cấu hình trong .env');

      const response = await axios.get(`https://api.locationiq.com/v1/autocomplete.php`, {
        params: {
          key: this.token,
          q: text,
          format: 'json',
          limit: 5,
        },
      });
      return response.data;
    } catch (error) {
      logger.error('Lỗi trong searchAutocomplete:', error.message);
      return [];
    }
  }
}

module.exports = new LocationService();

