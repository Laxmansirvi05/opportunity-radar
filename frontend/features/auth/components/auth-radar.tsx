'use client'

import { motion, useAnimationFrame, useMotionValue } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'

const OPPORTUNITIES = [
  { title: 'Google SWE Internship', type: 'Internship', color: '#3b82f6', angle: 0, distance: 220 },
  { title: 'Microsoft Explore Program', type: 'Explore', color: '#8b5cf6', angle: 60, distance: 180 },
  { title: 'Research Fellowship', type: 'Scholarship', color: '#0ea5e9', angle: 120, distance: 140 },
  { title: 'Global AI Hackathon', type: 'Hackathon', color: '#8b5cf6', angle: 180, distance: 220 },
  { title: 'Data Science Competition', type: 'Competition', color: '#3b82f6', angle: 240, distance: 180 },
  { title: 'Remote Developer Role', type: 'Job', color: '#0ea5e9', angle: 300, distance: 140 },
]

export function AuthRadar() {
  const sweepAngle = useMotionValue(0)
  const [activeNodes, setActiveNodes] = useState<boolean[]>(Array(OPPORTUNITIES.length).fill(false))
  const activeNodesRef = useRef<boolean[]>(Array(OPPORTUNITIES.length).fill(false))

  // Sweep rotates 360 degrees every 12 seconds (30 deg/sec)
  useAnimationFrame((t, delta) => {
    let current = sweepAngle.get() + (delta * 30) / 1000
    if (current >= 360) current %= 360
    sweepAngle.set(current)

    let changed = false
    const nextNodes = [...activeNodesRef.current]

    for (let i = 0; i < OPPORTUNITIES.length; i++) {
      const opp = OPPORTUNITIES[i]

      // CSS leading edge is UP (0deg). Math.cos 0deg is RIGHT (90deg in CSS).
      const hitAngle = (opp.angle + 90) % 360
      const diff = (current - hitAngle + 360) % 360

      // 60 degrees = 2 seconds of visibility at 12s/rev
      const isActive = diff >= 0 && diff <= 60

      if (nextNodes[i] !== isActive) {
        nextNodes[i] = isActive
        changed = true
      }
    }

    if (changed) {
      activeNodesRef.current = nextNodes
      setActiveNodes(nextNodes)
    }
  })

  return (
    <div className="relative w-[500px] h-[500px] flex items-center justify-center scale-[0.85] lg:scale-[1.25] origin-center select-none pointer-events-none">
      {/* Center Target Logo */}
      <div className="absolute z-30 w-16 h-16 rounded-full bg-white shadow-[0_0_40px_rgba(59,130,246,0.3)] flex items-center justify-center border border-slate-100">
        <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
      </div>

      {/* Center subtle glow */}
      <div className="absolute z-0 w-32 h-32 rounded-full bg-primary/10 blur-2xl"></div>

      {/* Concentric Rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-[200px] h-[200px] rounded-full border border-slate-200/60" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-slate-200/60" />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-slate-200/60" />
        <div className="absolute w-[500px] h-[500px] rounded-full border border-slate-200/60 border-dashed" />
      </div>

      {/* The Sweep */}
      <motion.div
        className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full overflow-hidden z-10 origin-center"
        style={{ rotate: sweepAngle }}
      >
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            background: 'conic-gradient(from 0deg at 50% 50%, rgba(59,130,246,0) 0deg, rgba(59,130,246,0) 270deg, rgba(59,130,246,0.1) 320deg, rgba(59,130,246,0.5) 360deg)'
          }}
        />
        {/* Leading edge line at 0 deg (UP) */}
        <div className="absolute top-0 left-[249px] w-[2px] h-[250px] bg-primary/80 blur-[1px] origin-bottom" />
      </motion.div>

      {/* Nodes */}
      {OPPORTUNITIES.map((opp, i) => {
        const rad = (opp.angle * Math.PI) / 180
        const x = Number((Math.cos(rad) * opp.distance).toFixed(2))
        const y = Number((Math.sin(rad) * opp.distance).toFixed(2))

        // Push the card label outward by 40px past the node
        const cardOffset = opp.distance + 40
        const cardX = Number((Math.cos(rad) * cardOffset).toFixed(2))
        const cardY = Number((Math.sin(rad) * cardOffset).toFixed(2))

        const isActive = activeNodes[i]

        return (
          <motion.div
            key={i}
            className="absolute z-20"
            style={{ x, y }}
            initial={{ y }}
            animate={{
              y: y + (isActive ? -5 : 0),
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Node Dot */}
            <motion.div
              className="absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg"
              style={{ backgroundColor: opp.color }}
              animate={{
                scale: isActive ? 1.5 : 1,
                boxShadow: isActive ? `0 0 20px ${opp.color}` : `0 0 0px ${opp.color}00`
              }}
            />

            {/* Ripple effect when active */}
            {isActive && (
              <motion.div
                className="absolute w-4 h-4 rounded-full -translate-x-1/2 -translate-y-1/2 border-2"
                style={{ borderColor: opp.color }}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 4.5, opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            )}

            {/* Floating Card - Positioned outward from the node */}
            <motion.div
              className="absolute bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-xl rounded-xl p-2.5 min-w-[160px]"
              style={{
                x: cardX - x, // offset relative to the node
                y: cardY - y,
                left: 0,
                top: '-24px',
                pointerEvents: isActive ? 'auto' : 'none'
              }}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{
                opacity: isActive ? 1 : 0,
                scale: isActive ? 1 : 0.95,
                y: isActive ? 0 : 12,
                filter: isActive ? 'drop-shadow(0 15px 25px rgba(59,130,246,0.3))' : 'drop-shadow(0 0px 0px rgba(0,0,0,0))'
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opp.color }} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{opp.type}</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 leading-tight">{opp.title}</p>
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}
