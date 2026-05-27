const ATTRIBUTE_KEY_LABELS: Record<string, string> = {
  color: 'Màu sắc',
  colour: 'Màu sắc',
  'màu sắc': 'Màu sắc',
  mau: 'Màu sắc',
  storage: 'Dung lượng',
  'dung lượng': 'Dung lượng',
  capacity: 'Dung lượng',
  ram: 'RAM',
  memory: 'RAM',
  'bộ nhớ': 'RAM',
  size: 'Kích cỡ',
  'kích cỡ': 'Kích cỡ',
  screen_size: 'Màn hình',
  'màn hình': 'Màn hình',
  cpu: 'CPU',
  processor: 'CPU',
  gpu: 'GPU',
  connectivity: 'Kết nối',
  battery: 'Pin',
  os: 'Hệ điều hành',
  variant: 'Phiên bản',
  'phiên bản': 'Phiên bản',
};

export const formatAttributeKey = (key: string): string =>
  ATTRIBUTE_KEY_LABELS[key.toLowerCase()] ?? key;
