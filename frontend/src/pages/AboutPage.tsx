import { Helmet } from 'react-helmet-async';
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();

  const values = [
    {
      title: t('about.value1.title'),
      description: t('about.value1.description'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 text-primary-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      title: t('about.value2.title'),
      description: t('about.value2.description'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 text-primary-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      title: t('about.value3.title'),
      description: t('about.value3.description'),
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 text-primary-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
    },
  ];

  const teamMembers = [
    {
      name: 'Sarah Johnson',
      role: t('about.teamMember1.role'),
      image:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Michael Chen',
      role: t('about.teamMember2.role'),
      image:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Emily Rodriguez',
      role: t('about.teamMember3.role'),
      image:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'David Kim',
      role: t('about.teamMember4.role'),
      image:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=80',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      <Helmet>
        <title>{t('about.pageTitle', { defaultValue: 'About' })} | TechStore</title>
      </Helmet>
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('about.heroTitle')}
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
          {t('about.heroSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20 items-center">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-6">
            {t('about.storyTitle')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('about.storyP1')}</p>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('about.storyP2')}</p>
          <p className="text-neutral-600 dark:text-neutral-400">{t('about.storyP3')}</p>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-700">
          <img
            src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80"
            alt={t('about.imgAlt')}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </div>
      </div>

      <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl p-12 mb-20 border border-neutral-100 dark:border-neutral-700/30">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-10 text-center">
          {t('about.valuesTitle')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <div
              key={index}
              className="bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-sm text-center border border-neutral-100 dark:border-neutral-700 transition-all duration-300 hover:shadow-md hover:-translate-y-1"
            >
              <div className="flex justify-center mb-6">{value.icon}</div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">
                {value.title}
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed tabular-nums">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-20">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-10 text-center">
          {t('about.teamTitle')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {teamMembers.map((member, index) => (
            <div key={index} className="text-center group">
              <div className="rounded-full overflow-hidden w-48 h-48 mx-auto mb-6 border-4 border-white dark:border-neutral-800 shadow-xl transition-transform duration-500 group-hover:scale-105">
                <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                {member.name}
              </h3>
              <p className="text-primary-600 dark:text-primary-400 font-medium">{member.role}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-12 text-center text-white shadow-2xl shadow-primary-500/20">
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
      </div>
    </div>
  );
};

export default AboutPage;
