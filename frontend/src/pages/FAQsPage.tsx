import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

const FAQsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const faqs: FAQ[] = [
    { question: t('faqs.q1.question'), answer: t('faqs.q1.answer'), category: 'account' },
    { question: t('faqs.q2.question'), answer: t('faqs.q2.answer'), category: 'account' },
    { question: t('faqs.q3.question'), answer: t('faqs.q3.answer'), category: 'account' },
    { question: t('faqs.q4.question'), answer: t('faqs.q4.answer'), category: 'payment' },
    { question: t('faqs.q5.question'), answer: t('faqs.q5.answer'), category: 'payment' },
    { question: t('faqs.q6.question'), answer: t('faqs.q6.answer'), category: 'payment' },
    { question: t('faqs.q7.question'), answer: t('faqs.q7.answer'), category: 'shipping' },
    { question: t('faqs.q8.question'), answer: t('faqs.q8.answer'), category: 'shipping' },
    { question: t('faqs.q9.question'), answer: t('faqs.q9.answer'), category: 'shipping' },
    { question: t('faqs.q10.question'), answer: t('faqs.q10.answer'), category: 'returns' },
    { question: t('faqs.q11.question'), answer: t('faqs.q11.answer'), category: 'returns' },
    { question: t('faqs.q12.question'), answer: t('faqs.q12.answer'), category: 'returns' },
    { question: t('faqs.q13.question'), answer: t('faqs.q13.answer'), category: 'products' },
    { question: t('faqs.q14.question'), answer: t('faqs.q14.answer'), category: 'products' },
    { question: t('faqs.q15.question'), answer: t('faqs.q15.answer'), category: 'support' },
  ];

  const categories = [
    { id: 'all', name: t('faqs.cat.all') },
    { id: 'account', name: t('faqs.cat.account') },
    { id: 'payment', name: t('faqs.cat.payment') },
    { id: 'shipping', name: t('faqs.cat.shipping') },
    { id: 'returns', name: t('faqs.cat.returns') },
    { id: 'products', name: t('faqs.cat.products') },
    { id: 'support', name: t('faqs.cat.support') },
  ];

  const filteredFAQs = faqs.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('faqs.pageTitle')}
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
          {t('faqs.pageSubtitle')}
        </p>
      </div>

      <div className="max-w-2xl mx-auto mb-10">
        <div className="relative">
          <input
            type="text"
            placeholder={t('faqs.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-12 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 sticky top-24">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">
              {t('faqs.sidebarTitle')}
            </h2>
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <button
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      activeCategory === category.id
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {category.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:w-3/4">
          {filteredFAQs.length === 0 ? (
            <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                {t('faqs.empty.title')}
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                {t('faqs.empty.desc')}
              </p>
              <button
                onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                {t('faqs.empty.resetBtn')}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredFAQs.map((faq, index) => (
                <div key={index} className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 border border-neutral-200 dark:border-neutral-700">
                  <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-3">{faq.question}</h3>
                  <p className="text-neutral-600 dark:text-neutral-400">{faq.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-16 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('faqs.contact.title')}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-2xl mx-auto">
          {t('faqs.contact.desc')}
        </p>
        <Link to="/contact" className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
          {t('faqs.contact.btn')}
        </Link>
      </div>
    </div>
  );
};

export default FAQsPage;
