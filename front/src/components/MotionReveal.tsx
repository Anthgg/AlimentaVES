import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export function MotionReveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion()
  const canReveal = typeof IntersectionObserver !== 'undefined' && !reduceMotion
  return <motion.div
    className={className}
    initial={canReveal ? { opacity: 0, y: 12 } : false}
    whileInView={canReveal ? { opacity: 1, y: 0 } : undefined}
    viewport={{ once: false, amount: 0.14 }}
    transition={{ duration: 0.38, ease: [0.22, 0.72, 0.3, 1] }}
  >{children}</motion.div>
}
