import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Props {
  currentStep: number;
  steps: { key: string; labelKey: string }[];
}

export default function CheckoutStepIndicator({ currentStep, steps }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                  transition-colors duration-300
                  ${isCompleted ? 'bg-primary-500 text-white' : ''}
                  ${isActive ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-neutral-900 bg-primary-500/10 text-primary-600 dark:text-primary-400' : ''}
                  ${!isCompleted && !isActive ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400' : ''}
                `}
                initial={false}
                animate={isCompleted ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : idx + 1}
              </motion.div>
              <span
                className={`mt-2 text-xs font-medium whitespace-nowrap ${
                  isActive || isCompleted
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                {t(step.labelKey)}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div className="w-16 sm:w-24 h-0.5 mx-2 mt-[-1.25rem] relative overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary-500"
                  initial={false}
                  animate={{ width: isCompleted ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
