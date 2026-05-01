import chatReducer from '@/features/ai/store/chatSlice';
import authReducer from '@/features/auth/authSlice';
import cartReducer from '@/features/cart/cartSlice';
import productsReducer from '@/features/products/productsSlice';
import uiReducer from '@/features/ui/uiSlice';
import wishlistReducer from '@/features/wishlist/wishlistSlice';
import { api } from '@/services/api';
import { attributeApi } from '@/services/attributeApi';
import { bannerApi } from '@/services/bannerApi';
import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    [attributeApi.reducerPath]: attributeApi.reducer,
    [bannerApi.reducerPath]: bannerApi.reducer,
    auth: authReducer,
    cart: cartReducer,
    ui: uiReducer,
    chat: chatReducer,
    products: productsReducer,
    wishlist: wishlistReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware, attributeApi.middleware, bannerApi.middleware),
});

// Disable auto-refetch to prevent unnecessary API calls
// setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
