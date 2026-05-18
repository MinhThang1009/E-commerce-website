import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import các file dịch
import enTranslations from '../locales/en.json';
import viTranslations from '../locales/vi.json';

const RESOURCES = {
  en: {
    translation: enTranslations,
  },
  vi: {
    translation: viTranslations,
  },
};

i18n.use(initReactI18next).init({
  resources: RESOURCES,
  lng: localStorage.getItem('language') || 'vi', // Mặc định là tiếng Việt
  fallbackLng: 'vi',

  interpolation: {
    escapeValue: false, // React đã tự xử lý escaping
  },

  // Bật chế độ debug trong môi trường development
  debug: process.env.NODE_ENV === 'development',

  // Cấu hình namespace
  defaultNS: 'translation',
  ns: ['translation'],

  // Tùy chọn phát hiện ngôn ngữ
  detection: {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
  },
});

export default i18n;
