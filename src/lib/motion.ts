// BetterMate Motion wrapper
// framer-motion is not yet installed — this is a safe stub
// When framer-motion is added: replace with import * as FM from 'framer-motion'

export const Motion = {
  motion: {} as any,
  AnimatePresence: ({children}: {children: React.ReactNode}) => children,
};

export default Motion;
