import chatReducer from '@/features/ai/store/chatSlice';
import { authReducer } from '@/features/auth';
import cartReducer from '@/features/cart/cartSlice';
import productsReducer from '@/features/products/productsSlice';
import uiReducer from '@/features/ui/uiSlice';
import wishlistReducer from '@/features/wishlist/wishlistSlice';
import { api } from '@/services/api';
import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    cart: cartReducer,
    ui: uiReducer,
    chat: chatReducer,
    products: productsReducer,
    wishlist: wishlistReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

// Tắt auto-refetch để tránh các lời gọi API không cần thiết
// setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

