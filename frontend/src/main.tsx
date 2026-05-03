import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { initializeCart } from '@/features/cart/cartSlice';
import './config/i18n'; // Khởi tạo i18n
import App from './App';

import { GoogleOAuthProvider } from '@react-oauth/google';

// Khởi tạo giỏ hàng từ localStorage
store.dispatch(initializeCart());

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </Provider>
  </React.StrictMode>
);

