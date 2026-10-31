// The page's only animation: a small burst of confetti where someone clicks a kudo. Nothing
// happens for people who ask the system for less motion.

const colors = ['#fbbf24', '#8b5cf6', '#ff9ecf', '#60a5fa']

export function confetti(x: number, y: number, pieces = 40) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  for (let i = 0; i < pieces; i++) {
    const c = document.createElement('i')
    c.className = 'confetti'
    c.style.background = colors[i % colors.length]
    c.style.left = `${x}px`
    c.style.top = `${y}px`
    document.body.append(c)
    const angle = Math.random() * Math.PI * 2
    const dist = 60 + Math.random() * 90
    const to = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 80}px) rotate(${Math.random() * 720}deg)`
    const a = c.animate([{ transform: 'translate(0, 0)', opacity: 1 }, { transform: to, opacity: 0 }], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)' })
    a.onfinish = () => c.remove()
  }
}
