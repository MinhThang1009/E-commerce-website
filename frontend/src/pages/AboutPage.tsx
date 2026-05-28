/**
 * @file AboutPage.tsx
 * @layer Page
 * @feature global
 * @description Top-level page component
 */
import { Helmet } from 'react-helmet-async';
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';
import { ShieldCheck, Users, Lightbulb, Info } from 'lucide-react';
import PageHero from '@/components/common/PageHero';
import { motion } from 'framer-motion';
import { fadeUp, stagger, itemFade, viewportOnce } from '@/utils/motion';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  const values = [
    {
      title: t('about.value1.title'),
      description: t('about.value1.description'),
      icon: <ShieldCheck className="w-10 h-10 text-primary-500" />,
      color: 'bg-primary-50 dark:bg-primary-900/20',
    },
    {
      title: t('about.value2.title'),
      description: t('about.value2.description'),
      icon: <Users className="w-10 h-10 text-primary-500" />,
      color: 'bg-teal-50 dark:bg-teal-900/20',
    },
    {
      title: t('about.value3.title'),
      description: t('about.value3.description'),
      icon: <Lightbulb className="w-10 h-10 text-primary-500" />,
      color: 'bg-amber-50 dark:bg-amber-900/20',
    },
  ];

  // Avatar trung tính dùng DiceBear API (no external photos, GDPR safe)
  const teamMembers = [
    {
      name: 'Ngô Văn Minh Thắng',
      role: t('about.teamMember1.role'),
      image: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Thang&backgroundColor=b6e3f4',
    },
    {
      name: 'Trần Quang Minh',
      role: t('about.teamMember2.role'),
      image: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Minh&backgroundColor=c0aede',
    },
    {
      name: 'Nguyễn Thị Lan Anh',
      role: t('about.teamMember3.role'),
      image: 'https://api.dicebear.com/9.x/avataaars/svg?seed=LanAnh&backgroundColor=ffd5dc',
    },
    {
      name: 'Phạm Đức Hùng',
      role: t('about.teamMember4.role'),
      image: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Hung&backgroundColor=d1d4f9',
    },
  ];

  return (
    <div>
      <Helmet>
        <title>{t('about.pageTitle', { defaultValue: 'About' })} | TechStore</title>
      </Helmet>

      <PageHero
        icon={<Info className="w-7 h-7 text-white" />}
        title={t('about.heroTitle')}
        subtitle={t('about.heroSubtitle')}
        gradient="cool"
      />

      <div className="container mx-auto px-4 py-16">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20 items-center"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={stagger}
        >
          <motion.div variants={fadeUp}>
            <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6">
              {t('about.storyTitle')}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('about.storyP1')}</p>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('about.storyP2')}</p>
            <p className="text-neutral-600 dark:text-neutral-400">{t('about.storyP3')}</p>
          </motion.div>
          <motion.div
            variants={fadeUp}
            className="rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-700"
          >
            {/* Ảnh collage sản phẩm TechStore từ DB */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 dark:bg-neutral-800">
              <img
                src="https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/42/342667/iphone-17-xanh-6-638930798970669098-750x500.jpg"
                alt="iPhone 17"
                className="w-full h-40 object-cover rounded-tl-xl"
                loading="lazy"
              />
              <img
                src="https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/336967/acer-aspire-lite-15-al15-71p-517d-i5-nxj7ksv001-thumb-638804825325953513-600x600.jpg"
                alt="Laptop"
                className="w-full h-40 object-cover rounded-tr-xl"
                loading="lazy"
              />
              <img
                src="https://cdn.tgdd.vn/Products/Images/7077/338266/samsung-galaxy-watch8-classic-trang-tn-600x600.jpg"
                alt="Smartwatch"
                className="w-full h-40 object-cover rounded-bl-xl"
                loading="lazy"
              />
              <img
                src="https://cdn.tgdd.vn/Products/Images/522/344725/samsung-galaxy-tab-s11-ultra-5g-12gb-256gb-xam-1-600x600.jpg"
                alt="Tablet"
                className="w-full h-40 object-cover rounded-br-xl"
                loading="lazy"
              />
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          className="bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl p-12 mb-20 border border-neutral-100 dark:border-neutral-700/30"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
        >
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-10 text-center">
            {t('about.valuesTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-sm text-center border border-neutral-100 dark:border-neutral-700 transition-all duration-300 hover:shadow-md hover:-translate-y-1"
              >
                <div
                  className={`w-16 h-16 ${value.color} rounded-2xl flex items-center justify-center mx-auto mb-6`}
                >
                  {value.icon}
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">
                  {value.title}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={stagger}
        >
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-10 text-center">
            {t('about.teamTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {teamMembers.map((member, index) => (
              <motion.div key={index} className="text-center group" variants={itemFade}>
                <div className="rounded-2xl overflow-hidden w-48 h-48 mx-auto mb-6 border-4 border-white dark:border-neutral-800 shadow-xl transition-transform duration-500 group-hover:scale-105">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                  {member.name}
                </h3>
                <p className="text-primary-600 dark:text-primary-400 font-medium">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-12 text-center text-white shadow-2xl shadow-primary-500/20"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeUp}
        >
          <h2 className="text-3xl font-bold mb-4">{t('about.ctaTitle')}</h2>
          <p className="text-white/80 max-w-2xl mx-auto mb-10 text-lg">{t('about.ctaDesc')}</p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link
              to={ROUTES.SHOP}
              className="bg-white text-primary-600 hover:bg-neutral-50 font-bold py-4 px-10 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              {t('about.ctaShopBtn')}
            </Link>
            <Link
              to={ROUTES.CONTACT}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-md font-bold py-4 px-10 rounded-2xl transition-all duration-300 hover:-translate-y-1"
            >
              {t('about.ctaContactBtn')}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutPage;
