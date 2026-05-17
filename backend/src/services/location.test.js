/**
 * Phase 44 — Unit tests cho LocationService (services/location.js)
 * Cover: 3 method (reverse geocoding, forward geocoding, autocomplete) + error fallback.
 */

process.env.LOCATION_IQ_TOKEN = 'test-iq-token';

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const axios = require('axios');
const locationService = require('../services/location');

beforeEach(() => {
  axios.get.mockReset();
});

describe('LocationService.getAddressFromCoords', () => {
  test('GET /reverse.php với lat + lon, return data', async () => {
    axios.get.mockResolvedValue({
      data: { display_name: '123 Nguyễn Huệ, Quận 1, Hồ Chí Minh' },
    });

    const result = await locationService.getAddressFromCoords(10.776, 106.700);

    expect(axios.get).toHaveBeenCalledWith(
      'https://us1.locationiq.com/v1/reverse.php',
      expect.objectContaining({
        params: { key: 'test-iq-token', lat: 10.776, lon: 106.700, format: 'json' },
      })
    );
    expect(result).toEqual({ display_name: expect.any(String) });
  });

  test('Axios error → return { error } (fallback gracefully)', async () => {
    axios.get.mockRejectedValue(new Error('Network down'));

    const result = await locationService.getAddressFromCoords(0, 0);

    expect(result).toEqual({ error: 'Không thể lấy địa chỉ' });
  });
});

describe('LocationService.getCoordsFromAddress', () => {
  test('GET /search.php với q + limit=1', async () => {
    axios.get.mockResolvedValue({
      data: [{ lat: '10.776', lon: '106.700' }],
    });

    const result = await locationService.getCoordsFromAddress('123 Nguyễn Huệ');

    expect(axios.get).toHaveBeenCalledWith(
      'https://us1.locationiq.com/v1/search.php',
      expect.objectContaining({
        params: { key: 'test-iq-token', q: '123 Nguyễn Huệ', format: 'json', limit: 1 },
      })
    );
    expect(result).toEqual([{ lat: '10.776', lon: '106.700' }]);
  });

  test('Axios error → return [] (graceful fallback)', async () => {
    axios.get.mockRejectedValue(new Error('Timeout'));

    const result = await locationService.getCoordsFromAddress('xxx');

    expect(result).toEqual([]);
  });
});

describe('LocationService.searchAutocomplete', () => {
  test('GET autocomplete.php với q + limit=5', async () => {
    axios.get.mockResolvedValue({
      data: [
        { display_name: 'Nguyễn Huệ Boulevard' },
        { display_name: 'Nguyễn Huệ Walking Street' },
      ],
    });

    const result = await locationService.searchAutocomplete('Nguyễn Huệ');

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.locationiq.com/v1/autocomplete.php',
      expect.objectContaining({
        params: { key: 'test-iq-token', q: 'Nguyễn Huệ', format: 'json', limit: 5 },
      })
    );
    expect(result).toHaveLength(2);
  });

  test('Axios error → return [] (graceful fallback)', async () => {
    axios.get.mockRejectedValue(new Error('Server 500'));

    const result = await locationService.searchAutocomplete('x');

    expect(result).toEqual([]);
  });
});
