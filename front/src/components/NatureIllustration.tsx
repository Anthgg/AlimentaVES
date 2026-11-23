import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Icon } from './Icon'

export function NatureIllustration() {
  const [paused, setPaused] = useState(false)
  const reduceMotion = useReducedMotion()
  return (
    <div className="np-art-wrap">
      <div className={`np-art-stage ${paused ? 'is-motion-paused' : ''}`}>
        <div className="np-art-note np-art-note-top"><span>ALIMENTO QUE CIRCULA</span><Icon name="leaf" size={18} /></div>
        <svg className="np-food-art" viewBox="0 0 620 540" role="img" aria-labelledby="np-plate-title np-plate-description">
          <title id="np-plate-title">Ilustración de una mesa compartida</title>
          <desc id="np-plate-description">Un plato con verduras, tomate, pan y una fruta representa el aprovechamiento comunitario de alimentos.</desc>
          <defs>
            <radialGradient id="np-plate-glow" cx="38%" cy="30%" r="75%"><stop offset="0" stopColor="#fffefa" /><stop offset="1" stopColor="#e5eadb" /></radialGradient>
            <linearGradient id="np-tomato" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#f6a263" /><stop offset="1" stopColor="#d65d3f" /></linearGradient>
            <linearGradient id="np-leaf-gradient" x1="0" x2="1"><stop stopColor="#7fae68" /><stop offset="1" stopColor="#2b704d" /></linearGradient>
            <filter id="np-plate-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="15" /></filter>
          </defs>
          <ellipse cx="315" cy="447" rx="210" ry="33" fill="#103f32" opacity=".17" filter="url(#np-plate-shadow)" />
          <g className="np-art-plate">
            <circle cx="310" cy="270" r="206" fill="#d5dfc9" />
            <circle cx="310" cy="259" r="197" fill="url(#np-plate-glow)" stroke="#fffefa" strokeWidth="8" />
            <circle cx="310" cy="259" r="161" fill="#f3f0df" stroke="#c9d6bc" strokeWidth="2" />
            <path d="M173 273c22-59 55-90 98-92 30 0 41 19 35 39-11 36-51 72-101 80-18 3-31-8-32-27Z" fill="url(#np-leaf-gradient)" />
            <path d="M182 280c36-32 69-58 113-84m-87 66c-4-21-16-35-33-40m52 24c0-21 8-37 24-50m-3 31c18-13 38-16 56-11" fill="none" stroke="#d7e9ac" strokeWidth="4" strokeLinecap="round" />
            <path d="M175 313c16 22 40 34 71 32 31-2 49-18 51-39 2-19-13-31-32-30-34 1-59 18-90 37Z" fill="#91b86a" />
            <path d="M188 316c30-13 60-24 93-29" fill="none" stroke="#e1edbc" strokeWidth="3" strokeLinecap="round" />
            <g className="np-art-produce np-produce-one"><circle cx="366" cy="199" r="48" fill="url(#np-tomato)" /><path d="m366 153 7 15 17-6-11 14 11 10-17-4-6 15-6-16-17 5 12-13-12-11 17 3Z" fill="#376f4a" /><path d="M365 155c-1-10 4-16 12-20" fill="none" stroke="#376f4a" strokeWidth="6" strokeLinecap="round" /></g>
            <g className="np-art-produce np-produce-two"><path d="M392 277c26-27 58-30 83-8 19 17 17 44-5 61-23 17-55 12-76-15-11-14-12-28-2-38Z" fill="#eda15f" /><path d="M414 271c13 17 27 33 47 48m-55-36c15 4 30 4 46-1m-31 18c14 1 27-2 39-8m-22 24c11-2 21-6 29-13" fill="none" stroke="#f9ca8c" strokeWidth="4" strokeLinecap="round" /></g>
            <g className="np-art-produce np-produce-three"><path d="M273 344c3-22 21-34 45-33 22 0 39 13 41 33 2 22-17 43-43 43-26 0-46-20-43-43Z" fill="#d6a75b" /><path d="M282 350c22-8 43-8 66-1m-62 12c17-5 34-5 51-1" fill="none" stroke="#f2d494" strokeWidth="4" strokeLinecap="round" /></g>
            <g className="np-art-seeds" fill="#83a95f"><ellipse cx="329" cy="207" rx="18" ry="8" transform="rotate(-24 329 207)" /><ellipse cx="340" cy="222" rx="18" ry="8" transform="rotate(18 340 222)" /><ellipse cx="321" cy="238" rx="16" ry="7" transform="rotate(-9 321 238)" /></g>
            <path d="M295 204c-15-17-12-37 5-47 17 17 19 33 8 49" fill="#bfd987" />
          </g>
          <g className="np-art-orbit" fill="none" stroke="#31835c" strokeOpacity=".16" strokeWidth="1.5"><ellipse cx="310" cy="268" rx="257" ry="206" transform="rotate(-16 310 268)" /><circle cx="93" cy="157" r="5" fill="#e99359" stroke="none" /><circle cx="533" cy="369" r="4" fill="#31835c" stroke="none" /></g>
        </svg>
        <div className="np-art-note np-art-note-bottom"><span>VILLA EL SALVADOR</span><span className="np-art-note-index">COMUNIDAD · ALIMENTO</span></div>
        <div className="np-art-sticker"><strong>La mesa</strong><span>se comparte</span><Icon name="arrow" size={16} /></div>
      </div>
      {!reduceMotion && <motion.button className="np-motion-toggle" type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)} whileHover={{ scale: 1.025 }} whileTap={{ scale: .97 }}>{paused ? 'Reanudar animación' : 'Pausar animación'}</motion.button>}
    </div>
  )
}
