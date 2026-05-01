import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShopIcon } from '@/components/icons';
import FeedbackModal from '@/components/common/FeedbackModal';

const Footer: React.FC = () => {
  const { t } = useTranslation();

  const socialLinks = [
    {
      name: 'facebook',
      url: 'https://facebook.com',
      icon: (
        <path
          fillRule="evenodd"
          d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
          clipRule="evenodd"
        />
      ),
    },
    {
      name: 'youtube',
      url: 'https://youtube.com',
      icon: (
        <path
          fillRule="evenodd"
          d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z"
          clipRule="evenodd"
        />
      ),
    },
    {
      name: 'tiktok',
      url: 'https://tiktok.com',
      icon: (
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      ),
    },
    {
      name: 'telegram',
      url: 'https://telegram.org',
      icon: (
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM16.64 8.76c-.22 2.31-1.19 8.01-1.68 10.64-.21 1.12-.66 1.48-1.07 1.51-.9.08-1.58-.59-2.45-1.16-.96-.63-1.5-1.03-2.43-1.64-1.07-.71-.38-1.1.24-1.73.16-.16 2.97-2.72 3.03-2.95.01-.03.01-.14-.05-.19-.07-.06-.17-.04-.25-.02-.34.08-5.83 3.69-6 3.86-.25.24-.95.48-2.16.47-1.34-.02-2.61-.41-2.96-.54-1.13-.42.7-2.31 1.94-2.82 5.09-2.22 8.49-3.69 10.18-4.4 3.73-1.56 4.67-1.28 5.25-.13z" />
      ),
    },
  ];

  const [isFeedbackModalVisible, setIsFeedbackModalVisible] = React.useState(false);

  return (
    <footer className="bg-white dark:bg-neutral-900 pt-16 pb-8 border-t border-neutral-200 dark:border-neutral-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand & Social */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative bg-gradient-to-r from-primary-500 to-secondary-500 p-1.5 rounded-lg">
                  <ShopIcon className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <span className="font-heading font-bold text-xl bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                  {t('header.brand')}
                </span>
              </div>
            </Link>

            <div className="flex space-x-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-primary-50 hover:text-primary-500 dark:hover:bg-primary-900/10 dark:hover:text-primary-400 transition-all duration-300"
                >
                  <span className="sr-only">{social.name}</span>
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    {social.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Hotline & Stores */}
          <div>
            <div className="mb-8">
              <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-lg mb-2">
                {t('footer.hotline')}
              </h4>
              <a
                href="tel:1900633579"
                className="text-2xl font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                style={{ fontFamily: 'monospace' }}
              >
                📞 1900.63.3579
              </a>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-base mb-3">
                  Cửa hàng Hà Nội
                </h4>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-1">🏪</span>
                    <p>53 Thái Hà, Trung Liệt, Đống Đa ({t('footer.directions')})</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-base mb-3">
                  Cửa hàng TP. HCM
                </h4>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-1">🏪</span>
                    <p>5 - 7 Nguyễn Huy Tưởng, P.6, Q.Bình Thạnh ({t('footer.directions')})</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1">🏪</span>
                    <p>95 Trần Thiện Chánh, P.12, Q.10 ({t('footer.directions')})</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Useful Info */}
          <div>
            <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-lg mb-6">
              Thông tin hữu ích
            </h4>
            <ul className="space-y-3">
              {[
                'Chính sách bảo hành',
                'Chính sách đổi trả',
                'Chính sách vận chuyển',
                'Chính sách bảo mật',
                'Chính sách thanh toán',
                'Chính sách kiểm hàng',
                'Hướng dẫn mua hàng online',
                'Về chúng tôi',
              ].map((item) => (
                <li key={item}>
                  <Link
                    to="/"
                    className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors block"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Feedback */}
          <div>
            <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-lg mb-6">
              Phản hồi, góp ý
            </h4>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-6 border border-neutral-100 dark:border-neutral-800">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 leading-relaxed">
                {t('footer.feedback.description')}
              </p>
              <button
                className="w-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium py-3 px-6 rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all duration-300 flex items-center justify-center gap-2 group"
                onClick={() => setIsFeedbackModalVisible(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                {t('footer.feedback.sendButton')}
              </button>
            </div>
          </div>
        </div>

        {/* Modal feedback */}
        <FeedbackModal
          visible={isFeedbackModalVisible}
          onClose={() => setIsFeedbackModalVisible(false)}
        />

        {/* Bottom Footer */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-8 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-sm text-neutral-500 dark:text-neutral-500">
              <p className="mb-2">
                &copy; {new Date().getFullYear()} {t('header.brand')}. {t('footer.copyright')}
              </p>
              <p className="mb-1">
                Công ty TNHH Công nghệ Think Việt Nam - GPĐKKD: 0107273909 do sở
                KH & ĐT TP Hà Nội cấp ngày 09/03/2020
              </p>
              <p>
                Địa chỉ: 105/562 Đường Láng, Phường Láng Hạ, Quận Đống Đa, Hà
                Nội. Điện thoại: 1900633579
              </p>
            </div>
            <div className="flex items-end justify-start md:justify-end gap-2">
              <div className="bg-blue-500 text-white px-2 py-1 text-xs font-bold rounded">dmca PROTECTED</div>
              <div className="bg-blue-600 text-white px-2 py-1 text-xs font-bold rounded">ĐÃ THÔNG BÁO - BCT</div>
              <div className="bg-red-600 text-white px-2 py-1 text-xs font-bold rounded">ĐÃ ĐĂNG KÝ - BCT</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
