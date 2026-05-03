import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '@/types/user.types';
import { AuthState, AuthResponse } from '@/types/auth.types';

// Token lưu trong localStorage để persist qua page reload.
// Trade-off đã đánh giá: XSS script có thể đọc localStorage, nhưng rủi ro được
// giảm thiểu bởi xss-clean middleware + DOMPurify ở frontend (Phase 1).
// Chuyển sang httpOnly cookie sẽ an toàn hơn nhưng cần sửa CORS + backend set-cookie
// — đây là cải thiện có thể làm sau khi project scale lên production.
// KHÔNG log token ra console (Rule 17).

// Lấy token từ localStorage một cách an toàn
const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem('token');
  } catch (error) {
    return null;
  }
};

const getStoredRefreshToken = (): string | null => {
  try {
    return localStorage.getItem('refreshToken');
  } catch (error) {
    return null;
  }
};

const getStoredUser = (): User | null => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    return null;
  }
};

const initialState: AuthState = {
  user: getStoredUser(),
  token: getStoredToken(),
  refreshToken: getStoredRefreshToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: false,
  error: null,
  justLoggedIn: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<AuthResponse>) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.justLoggedIn = true;
      // Lưu token vào localStorage — xem comment ở đầu file về trade-off bảo mật
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.justLoggedIn = false;
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('cartItems'); // Xóa giỏ hàng khi đăng xuất
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    updateTokens: (
      state,
      action: PayloadAction<{ token: string; refreshToken: string }>
    ) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
    },
    clearJustLoggedIn: (state) => {
      state.justLoggedIn = false;
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  updateUser,
  clearError,
  updateTokens,
  clearJustLoggedIn,
} = authSlice.actions;

export default authSlice.reducer;

