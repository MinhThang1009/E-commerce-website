// TextEncoder/TextDecoder polyfill cho react-router v7
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

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

// framer-motion mock — ESM module không work với ts-jest
jest.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy({}, {
    get: (_, tag) => React.forwardRef((props, ref) => {
      const { initial, animate, exit, variants, whileHover, whileInView, whileTap,
        viewport, transition, layout, layoutId, ...rest } = props;
      return React.createElement(tag, { ...rest, ref });
    }),
  });
  return {
    __esModule: true,
    motion,
    AnimatePresence: ({ children }) => children,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => 0,
    useMotionValue: (v) => ({ get: () => v, set: () => {} }),
    useReducedMotion: () => false,
  };
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
