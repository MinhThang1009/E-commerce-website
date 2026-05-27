import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const variants: any = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <motion.div key={pathname} variants={variants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}
