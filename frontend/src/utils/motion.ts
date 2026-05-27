// eslint-disable-next-line @typescript-eslint/no-explicit-any
type V = any;

export const fadeUp: V = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export const stagger: V = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export const itemFade: V = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export const viewportOnce = { once: true, margin: '-60px' as const };
