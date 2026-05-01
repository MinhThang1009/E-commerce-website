const axios = require('axios');

class LocationService {
  constructor() {
    this.token = process.env.LOCATION_IQ_TOKEN;
    this.baseUrl = 'https://us1.locationiq.com/v1';
  }

  // 1. 역 geocoding: getAddressFromCoords(lat, lon)
  async getAddressFromCoords(lat, lon) {
    try {
      if (!this.token) throw new Error('LOCATION_IQ_TOKEN is not configured in .env');
      
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
      console.error('Error in getAddressFromCoords:', error.message);
      return { error: 'Could not fetch address' };
    }
  }

  // 2. Forward geocoding: getCoordsFromAddress(address)
  async getCoordsFromAddress(address) {
    try {
      if (!this.token) throw new Error('LOCATION_IQ_TOKEN is not configured in .env');
      
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
      console.error('Error in getCoordsFromAddress:', error.message);
      return [];
    }
  }

  // 3. Autocomplete: searchAutocomplete(text)
  async searchAutocomplete(text) {
    try {
      if (!this.token) throw new Error('LOCATION_IQ_TOKEN is not configured in .env');
      
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
      console.error('Error in searchAutocomplete:', error.message);
      return [];
    }
  }
}

module.exports = new LocationService();
