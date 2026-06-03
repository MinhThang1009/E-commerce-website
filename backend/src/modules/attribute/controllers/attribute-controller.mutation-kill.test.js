// Attribute controller — mutation-kill: assert full response body (status +
// data + message tiếng Việt cụ thể), status code, service-call args, và fallback
// (separator||' ', includeDetails||false, selectedAttributes||[]), 400 guards.

process.env.NODE_ENV = 'test';

const mockService = {
  getAttributeGroups: jest.fn(),
  getProductAttributeGroups: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  addValue: jest.fn(),
  updateValue: jest.fn(),
  deleteValue: jest.fn(),
  assignGroupToProduct: jest.fn(),
  previewProductName: jest.fn(),
  getNameAffectingAttributes: jest.fn(),
  batchGenerateNames: jest.fn(),
  generateNameRealTime: jest.fn(),
  setNameGenerator: jest.fn(),
};
jest.mock('@modules/attribute/services/attribute-service', () => mockService);

const controller = require('./attribute-controller');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
const next = () => jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('attribute controller — response body + args + message', () => {
  test('getProductAttributeGroups → status success + data từ service', async () => {
    mockService.getProductAttributeGroups.mockResolvedValue([{ id: 1 }]);
    const res = makeRes();
    await controller.getProductAttributeGroups({ params: { productId: 7 } }, res, next());

    expect(mockService.getProductAttributeGroups).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: [{ id: 1 }] });
  });

  test('createAttributeGroup → 201 + message "Tạo nhóm thuộc tính thành công" + arg req.body', async () => {
    mockService.createGroup.mockResolvedValue({ id: 1 });
    const res = makeRes();
    const body = { name: 'Màu' };
    await controller.createAttributeGroup({ body }, res, next());

    expect(mockService.createGroup).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { id: 1 },
      message: 'Tạo nhóm thuộc tính thành công',
    });
  });

  test('updateAttributeGroup → message "Cập nhật nhóm thuộc tính thành công" + args (id, body)', async () => {
    mockService.updateGroup.mockResolvedValue({ id: 2 });
    const res = makeRes();
    await controller.updateAttributeGroup(
      { params: { id: '2' }, body: { name: 'X' } },
      res,
      next(),
    );

    expect(mockService.updateGroup).toHaveBeenCalledWith('2', { name: 'X' });
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { id: 2 },
      message: 'Cập nhật nhóm thuộc tính thành công',
    });
  });

  test('deleteAttributeGroup → message "Xóa nhóm thuộc tính thành công" + arg id', async () => {
    mockService.deleteGroup.mockResolvedValue();
    const res = makeRes();
    await controller.deleteAttributeGroup({ params: { id: '3' } }, res, next());

    expect(mockService.deleteGroup).toHaveBeenCalledWith('3');
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Xóa nhóm thuộc tính thành công',
    });
  });

  test('addAttributeValue → 201 + message + arg {...body, attributeGroupId}', async () => {
    mockService.addValue.mockResolvedValue({ id: 4 });
    const res = makeRes();
    await controller.addAttributeValue(
      { params: { attributeGroupId: '9' }, body: { name: 'Đỏ' } },
      res,
      next(),
    );

    expect(mockService.addValue).toHaveBeenCalledWith({ name: 'Đỏ', attributeGroupId: '9' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { id: 4 },
      message: 'Thêm giá trị thuộc tính thành công',
    });
  });

  test('updateAttributeValue → message "Cập nhật giá trị thuộc tính thành công"', async () => {
    mockService.updateValue.mockResolvedValue({ id: 5 });
    const res = makeRes();
    await controller.updateAttributeValue(
      { params: { id: '5' }, body: { name: 'Y' } },
      res,
      next(),
    );

    expect(mockService.updateValue).toHaveBeenCalledWith('5', { name: 'Y' });
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { id: 5 },
      message: 'Cập nhật giá trị thuộc tính thành công',
    });
  });

  test('deleteAttributeValue → message "Xóa giá trị thuộc tính thành công" + arg id', async () => {
    mockService.deleteValue.mockResolvedValue();
    const res = makeRes();
    await controller.deleteAttributeValue({ params: { id: '6' } }, res, next());

    expect(mockService.deleteValue).toHaveBeenCalledWith('6');
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Xóa giá trị thuộc tính thành công',
    });
  });

  test('assignAttributeGroupToProduct → 201 + message + arg {productId, attributeGroupId, ...body}', async () => {
    mockService.assignGroupToProduct.mockResolvedValue({ id: 7 });
    const res = makeRes();
    await controller.assignAttributeGroupToProduct(
      { params: { productId: 'p1', attributeGroupId: 'g1' }, body: { sortOrder: 2 } },
      res,
      next(),
    );

    expect(mockService.assignGroupToProduct).toHaveBeenCalledWith({
      productId: 'p1',
      attributeGroupId: 'g1',
      sortOrder: 2,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { id: 7 },
      message: 'Gán nhóm thuộc tính cho sản phẩm thành công',
    });
  });

  test('getNameAffectingAttributes → message + arg query.productId', async () => {
    mockService.getNameAffectingAttributes.mockResolvedValue([{ id: 1 }]);
    const res = makeRes();
    await controller.getNameAffectingAttributes({ query: { productId: '8' } }, res, next());

    expect(mockService.getNameAffectingAttributes).toHaveBeenCalledWith('8');
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: [{ id: 1 }],
      message: 'Lấy danh sách thuộc tính ảnh hưởng đến tên thành công',
    });
  });
});

describe('previewProductName — guard + fallback options', () => {
  test('thiếu baseName → 400 "Tên cơ sở là bắt buộc"', async () => {
    const res = makeRes();
    await controller.previewProductName({ body: {} }, res, next());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Tên cơ sở là bắt buộc' });
    expect(mockService.previewProductName).not.toHaveBeenCalled();
  });

  test('có giá trị → service nhận (baseName, selectedAttributes, {separator, includeDetails})', async () => {
    mockService.previewProductName.mockResolvedValue({ name: 'X' });
    const res = makeRes();
    await controller.previewProductName(
      {
        body: { baseName: 'Áo', selectedAttributes: [1, 2], separator: '-', includeDetails: true },
      },
      res,
      next(),
    );

    expect(mockService.previewProductName).toHaveBeenCalledWith('Áo', [1, 2], {
      separator: '-',
      includeDetails: true,
    });
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { name: 'X' },
      message: 'Tạo xem trước tên sản phẩm thành công',
    });
  });

  test('fallback: selectedAttributes→[], separator→" ", includeDetails→false', async () => {
    mockService.previewProductName.mockResolvedValue({ name: 'X' });
    const res = makeRes();
    await controller.previewProductName({ body: { baseName: 'Áo' } }, res, next());

    expect(mockService.previewProductName).toHaveBeenCalledWith('Áo', [], {
      separator: ' ',
      includeDetails: false,
    });
  });
});

describe('batchGenerateProductNames — guard + fallback', () => {
  test('items không phải mảng → 400 "Tham số items phải là một mảng"', async () => {
    const res = makeRes();
    await controller.batchGenerateProductNames({ body: { items: 'x' } }, res, next());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Tham số items phải là một mảng',
    });
    expect(mockService.batchGenerateNames).not.toHaveBeenCalled();
  });

  test('items là mảng → service(items, separator||" ") + message', async () => {
    mockService.batchGenerateNames.mockResolvedValue([{ name: 'a' }]);
    const res = makeRes();
    await controller.batchGenerateProductNames(
      { body: { items: [{ baseName: 'A' }] } },
      res,
      next(),
    );

    expect(mockService.batchGenerateNames).toHaveBeenCalledWith([{ baseName: 'A' }], ' ');
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: [{ name: 'a' }],
      message: 'Tạo tên sản phẩm hàng loạt thành công',
    });
  });
});

describe('generateNameRealTime — guard + args', () => {
  test('thiếu baseName → 400 "Tên cơ sở là bắt buộc"', async () => {
    const res = makeRes();
    await controller.generateNameRealTime({ body: {} }, res, next());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Tên cơ sở là bắt buộc' });
    expect(mockService.generateNameRealTime).not.toHaveBeenCalled();
  });

  test('đủ baseName → service(baseName, attributeValues, productId) + message', async () => {
    mockService.generateNameRealTime.mockResolvedValue({ name: 'X', suggestions: [] });
    const res = makeRes();
    await controller.generateNameRealTime(
      { body: { baseName: 'Áo', attributeValues: [1], productId: 9 } },
      res,
      next(),
    );

    expect(mockService.generateNameRealTime).toHaveBeenCalledWith('Áo', [1], 9);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: { name: 'X', suggestions: [] },
      message: 'Tạo tên theo thời gian thực thành công',
    });
  });
});
