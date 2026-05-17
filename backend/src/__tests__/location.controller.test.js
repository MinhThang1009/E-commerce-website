// Unit tests cho LocationController (src/controllers/location.js)
// Mock locationService để không gọi HTTP thật — kiểm tra validation và response
//
// NOTE: catchAsync trả về synchronous wrapper — không return promise.
// Để đợi .catch(next) thực thi sau khi service reject, cần flush microtask queue
// sau mỗi lời gọi controller trong error-path tests.

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../services/location', () => ({
  getAddressFromCoords: jest.fn(),
  getCoordsFromAddress: jest.fn(),
  searchAutocomplete: jest.fn(),
}));

const locationService = require('../services/location');
const locationController = require('../controllers/location');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    query: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ════════════════════════════════════════════════════════════════════════════
// getAddress (reverse geocoding)
// ════════════════════════════════════════════════════════════════════════════

describe('LocationController.getAddress', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả 400 khi thiếu cả lat và lon', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await locationController.getAddress(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Thiếu tham số lat hoặc lon' })
    );
    expect(locationService.getAddressFromCoords).not.toHaveBeenCalled();
  });

  test('trả 400 khi chỉ có lat mà thiếu lon', async () => {
    const req = makeReq({ query: { lat: '10.776' } });
    const res = makeRes();

    await locationController.getAddress(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(locationService.getAddressFromCoords).not.toHaveBeenCalled();
  });

  test('trả 400 khi chỉ có lon mà thiếu lat', async () => {
    const req = makeReq({ query: { lon: '106.700' } });
    const res = makeRes();

    await locationController.getAddress(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(locationService.getAddressFromCoords).not.toHaveBeenCalled();
  });

  test('trả 200 với data khi có đủ lat và lon', async () => {
    const mockData = { display_name: '123 Nguyễn Huệ, Quận 1, Hồ Chí Minh' };
    locationService.getAddressFromCoords.mockResolvedValue(mockData);

    const req = makeReq({ query: { lat: '10.776', lon: '106.700' } });
    const res = makeRes();

    await locationController.getAddress(req, res, jest.fn());

    expect(locationService.getAddressFromCoords).toHaveBeenCalledWith('10.776', '106.700');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockData });
  });

  test('gọi next(error) khi service ném lỗi', async () => {
    locationService.getAddressFromCoords.mockRejectedValue(new Error('Service error'));

    const req = makeReq({ query: { lat: '10.0', lon: '106.0' } });
    const res = makeRes();
    const next = jest.fn();

    locationController.getAddress(req, res, next);
    await flushPromises();

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getCoords (forward geocoding)
// ════════════════════════════════════════════════════════════════════════════

describe('LocationController.getCoords', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả 400 khi thiếu address', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await locationController.getCoords(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Thiếu tham số address' })
    );
    expect(locationService.getCoordsFromAddress).not.toHaveBeenCalled();
  });

  test('trả 200 với data khi có address', async () => {
    const mockCoords = [{ lat: '10.776', lon: '106.700' }];
    locationService.getCoordsFromAddress.mockResolvedValue(mockCoords);

    const req = makeReq({ query: { address: '123 Lê Lợi, TP.HCM' } });
    const res = makeRes();

    await locationController.getCoords(req, res, jest.fn());

    expect(locationService.getCoordsFromAddress).toHaveBeenCalledWith('123 Lê Lợi, TP.HCM');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: mockCoords });
  });

  test('gọi next(error) khi service ném lỗi', async () => {
    locationService.getCoordsFromAddress.mockRejectedValue(new Error('API down'));

    const req = makeReq({ query: { address: 'test' } });
    const res = makeRes();
    const next = jest.fn();

    locationController.getCoords(req, res, next);
    await flushPromises();

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// searchAutocomplete
// ════════════════════════════════════════════════════════════════════════════

describe('LocationController.searchAutocomplete', () => {
  beforeEach(() => jest.clearAllMocks());

  test('trả 400 khi thiếu text', async () => {
    const req = makeReq({ query: {} });
    const res = makeRes();

    await locationController.searchAutocomplete(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Thiếu tham số text' })
    );
    expect(locationService.searchAutocomplete).not.toHaveBeenCalled();
  });

  test('trả 200 với danh sách gợi ý khi có text', async () => {
    const suggestions = [
      { display_name: 'Nguyễn Huệ Boulevard' },
      { display_name: 'Nguyễn Huệ Walking Street' },
    ];
    locationService.searchAutocomplete.mockResolvedValue(suggestions);

    const req = makeReq({ query: { text: 'Nguyễn Huệ' } });
    const res = makeRes();

    await locationController.searchAutocomplete(req, res, jest.fn());

    expect(locationService.searchAutocomplete).toHaveBeenCalledWith('Nguyễn Huệ');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: suggestions });
  });

  test('trả 200 với mảng rỗng khi không có kết quả', async () => {
    locationService.searchAutocomplete.mockResolvedValue([]);

    const req = makeReq({ query: { text: 'xyzxyz123notfound' } });
    const res = makeRes();

    await locationController.searchAutocomplete(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: [] });
  });

  test('gọi next(error) khi service ném lỗi', async () => {
    locationService.searchAutocomplete.mockRejectedValue(new Error('API timeout'));

    const req = makeReq({ query: { text: 'test' } });
    const res = makeRes();
    const next = jest.fn();

    locationController.searchAutocomplete(req, res, next);
    await flushPromises();

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
