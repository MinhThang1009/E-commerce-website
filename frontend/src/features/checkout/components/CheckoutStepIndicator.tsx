import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, MapPin, CreditCard, ClipboardCheck } from 'lucide-react';

const STEP_ICONS = [MapPin, CreditCard, ClipboardCheck];

interface Props {
  currentStep: number;
  steps: { key: string; labelKey: string }[];
}

export default function CheckoutStepIndicator({ currentStep, steps }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-0 mb-10 px-4">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;
        const StepIcon = STEP_ICONS[idx] || Check;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                className={`
                  w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-sm
                  transition-all duration-300
                  ${isCompleted ? 'bg-primary-500 text-white shadow-primary-500/30' : ''}
                  ${isActive ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-neutral-900 bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-md' : ''}
                  ${!isCompleted && !isActive ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500' : ''}
                `}
                initial={false}
                animate={isCompleted ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
              </motion.div>
              <span
                className={`mt-2.5 text-xs font-semibold whitespace-nowrap ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : isCompleted
                      ? 'text-primary-500 dark:text-primary-400'
                      : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                {t(step.labelKey)}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div className="w-16 sm:w-28 h-1 mx-3 mt-[-1.25rem] relative overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
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
