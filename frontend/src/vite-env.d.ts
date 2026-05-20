/// <reference types="vite/client" />

// Khai báo module cho import file .tsx trực tiếp
declare module '*.tsx' {
  import React from 'react';
  const Component: React.ComponentType<Record<string, unknown>>;
  export default Component;
}

// Khai báo module cho import file .jsx trực tiếp
declare module '*.jsx' {
  import React from 'react';
  const Component: React.ComponentType<Record<string, unknown>>;
  export default Component;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_BUILD_SOURCEMAP: string;
  // Thêm các biến môi trường khác tại đây...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
