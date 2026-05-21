// Setup cho React component tests — chạy trước mỗi test suite

// ts-jest với moduleResolution:'bundler' compile `import React from 'react'` thành
// `react_1.default.useState` nhưng React CJS không có `.default` property.
// Polyfill này gán `.default = module` để namespace access hoạt động đúng.
const ReactCJS = require('react');
if (!ReactCJS.default) {
  Object.defineProperty(ReactCJS, 'default', { value: ReactCJS, configurable: true });
}

// matchMedia mock cho jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// localStorage mock
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});
