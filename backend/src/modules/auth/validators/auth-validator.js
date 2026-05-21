/**
 * @file auth-validator.js
 * @layer Validator
 * @module auth
 */
const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số',
  );

const registerSchema = z.object({
  email: z.string().min(1, 'Email không được để trống').email('Email không hợp lệ'),
  password: passwordSchema,
  firstName: z.string().min(1, 'Tên không được để trống'),
  lastName: z.string().min(1, 'Họ không được để trống'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().min(1, 'Email không được để trống').email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email không được để trống').email('Email không hợp lệ'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token không được để trống'),
  password: passwordSchema,
});

const emailSchema = z.object({
  email: z.string().min(1, 'Email không được để trống').email('Email không hợp lệ'),
});

const otpSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  otp: z.string().min(4, 'OTP không hợp lệ').max(8, 'OTP không hợp lệ'),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailSchema,
  otpSchema,
};
