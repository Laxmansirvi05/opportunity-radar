'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useMemo, useRef, useState, useEffect, Suspense } from 'react'
import * as THREE from 'three'
import { CSSRadarFallback } from '@/components/landing/css-radar-fallback'

const CYAN = '#06b6d4'
const PURPLE = '#8b5cf6'
const BLUE = '#3b82f6'

const OPPORTUNITIES = [
  { title: 'Google SWE Internship', tag: 'Internship', color: CYAN, trackIdx: 0 },
  { title: 'Global AI Hackathon', tag: 'Hackathon', color: PURPLE, trackIdx: 1 },
  { title: 'Research Scholarship', tag: 'Scholarship', color: BLUE, trackIdx: 2 },
  { title: 'Data Science Competition', tag: 'Competition', color: PURPLE, trackIdx: 3 },
  { title: 'Remote Developer Role', tag: 'Job', color: CYAN, trackIdx: 4 },
]

const RADII = [1.5, 2.25, 3.0, 3.75, 4.5]
const RADAR_SIZE = 5.0

function RadarRings() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {RADII.map((r, i) => (
        <mesh key={i}>
          <ringGeometry args={[r - 0.015, r, 64]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Outer bounding ring */}
      <mesh>
        <ringGeometry args={[RADAR_SIZE - 0.02, RADAR_SIZE, 64]} />
        <meshBasicMaterial color={BLUE} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Center dot */}
      <mesh>
        <circleGeometry args={[0.08, 32]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.8} />
      </mesh>
      {/* Inner subtle glow */}
      <mesh>
        <circleGeometry args={[1.2, 32]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.05} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.4, 32]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  )
}

function RadarSweep({ sweepRef }: { sweepRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (ref.current) {
      // Clockwise rotation
      ref.current.rotation.y -= delta * 1.2
      sweepRef.current = ref.current.rotation.y
    }
  })

  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const segments = 32
    const arc = Math.PI / 4 // 45 degree sweep
    shape.moveTo(0, 0)
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * arc
      shape.lineTo(Math.cos(a) * RADAR_SIZE, Math.sin(a) * RADAR_SIZE)
    }
    shape.lineTo(0, 0)
    return new THREE.ShapeGeometry(shape)
  }, [])

  return (
    <group ref={ref}>
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Leading edge line */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[RADAR_SIZE, 0.02]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function NodeCard({ data, isActive }: { data: typeof OPPORTUNITIES[0], isActive: boolean }) {
  const ref = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (ref.current) {
      const cameraPosition = state.camera.position.clone()
      ref.current.parent?.worldToLocal(cameraPosition)
      ref.current.lookAt(cameraPosition)

      const targetOp = isActive ? 1 : 0
      const targetY = isActive ? 0.4 : 0.0

      const ud = ref.current.userData
      ud.op = THREE.MathUtils.lerp(ud.op || 0, targetOp, delta * 6)
      ud.y = THREE.MathUtils.lerp(ud.y || 0, targetY, delta * 6)

      ref.current.position.y = ud.y

      if (ref.current.children.length > 0) {
        const el = document.getElementById(`card-${data.trackIdx}`)
        if (el) {
          el.style.opacity = ud.op.toString()
          el.style.transform = `scale(${0.9 + ud.op * 0.1})`
          el.style.pointerEvents = isActive ? 'auto' : 'none'
        }
      }
    }
  })

  return (
    <group ref={ref}>
      <Html center transform distanceFactor={5.0} style={{ pointerEvents: 'none' }}>
        <div
          id={`card-${data.trackIdx}`}
          className="w-48 rounded-xl border border-white/20 px-3.5 py-3 shadow-2xl backdrop-blur-xl transition-all"
          style={{ 
            background: 'rgba(10, 15, 30, 0.85)', 
            opacity: 0, 
            transform: 'scale(0.9)',
            boxShadow: `0 0 30px ${data.color}30`
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: data.color, boxShadow: `0 0 10px ${data.color}` }}
            />
            <span
              className="font-mono text-[10px] font-bold uppercase tracking-widest"
              style={{ color: data.color }}
            >
              {data.tag}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-white">
            {data.title}
          </p>
        </div>
      </Html>
    </group>
  )
}

function SignalNode({ data, sweepRef }: { data: typeof OPPORTUNITIES[0], sweepRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const rippleRef = useRef<THREE.Mesh>(null)
  
  // Fixed mathematical position prevents overlaps
  const radius = RADII[data.trackIdx]
  // Stagger angles so they are distributed evenly around the circle
  const baseAngle = (data.trackIdx * (Math.PI * 2)) / OPPORTUNITIES.length
  
  // Create a slow orbit
  const [angleOffset, setAngleOffset] = useState(0)
  
  const [isActive, setIsActive] = useState(false)
  const activeUntil = useRef(0)

  useFrame((state, delta) => {
    // Very slow continuous orbit
    const newOffset = angleOffset + delta * 0.1
    setAngleOffset(newOffset)
    
    const currentAngle = baseAngle + newOffset
    const x = Math.cos(currentAngle) * radius
    const z = Math.sin(currentAngle) * radius
    
    // Reverse math because sweep is rotating clockwise (negative y)
    const sweep = sweepRef.current
    const mod = (n: number, m: number) => ((n % m) + m) % m
    
    const worldAngle = Math.atan2(z, x)
    const diff = mod(worldAngle - sweep, Math.PI * 2)

    const t = state.clock.elapsedTime
    if (diff > 0 && diff < 0.25) {
      activeUntil.current = t + 1.8 // Stay visible for 1.8 seconds (prevents all from showing)
      if (!isActive) setIsActive(true)
    } else if (t > activeUntil.current && isActive) {
      setIsActive(false)
    }

    const targetIntensity = isActive ? 1 : 0
    const currentIntensity = (ref.current as any)?.userData.intensity || 0
    const newIntensity = THREE.MathUtils.lerp(currentIntensity, targetIntensity, delta * 5)
    
    if (ref.current) {
      ref.current.position.set(x, 0, z)
      ;(ref.current as any).userData.intensity = newIntensity
      
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + data.trackIdx)
      const s = 0.04 + pulse * 0.02 + newIntensity * 0.06
      ref.current.scale.setScalar(s)
      
      ;(ref.current.material as THREE.MeshBasicMaterial).color.set(data.color).lerp(new THREE.Color('#ffffff'), newIntensity * 0.6)
    }
    
    if (glowRef.current) {
      glowRef.current.position.set(x, 0, z)
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + data.trackIdx)
      const s = 0.08 + pulse * 0.04 + newIntensity * 0.2
      glowRef.current.scale.setScalar(s)
      ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - pulse) + newIntensity * 0.5
    }

    if (rippleRef.current) {
      rippleRef.current.position.set(x, 0, z)
      if (isActive) {
        rippleRef.current.scale.setScalar(rippleRef.current.scale.x + delta * 2.5)
        let rOp = 1 - ((rippleRef.current.scale.x - 1) / 3)
        if (rOp <= 0) {
          rippleRef.current.scale.setScalar(1)
          rOp = 1
        }
        ;(rippleRef.current.material as THREE.MeshBasicMaterial).opacity = rOp * 0.4 * newIntensity
      } else {
        rippleRef.current.scale.setScalar(1)
        ;(rippleRef.current.material as THREE.MeshBasicMaterial).opacity = 0
      }
    }
  })

  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={data.color} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={data.color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={rippleRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.08, 0.09, 32]} />
        <meshBasicMaterial
          color={data.color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Mount the card at the dynamic position using a nested group that updates every frame. 
          Actually, we can just let useFrame update the parent group, but we are updating meshes directly above. 
          Let's wrap the card in a group that syncs position. */}
      <SyncPosition sourceRef={ref}>
        <NodeCard data={data} isActive={isActive} />
      </SyncPosition>
    </group>
  )
}

function SyncPosition({ sourceRef, children }: { sourceRef: React.RefObject<any>, children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (ref.current && sourceRef.current) {
      ref.current.position.copy(sourceRef.current.position)
    }
  })
  return <group ref={ref}>{children}</group>
}

function OpportunityNodes({ sweepRef }: { sweepRef: React.MutableRefObject<number> }) {
  return (
    <group>
      {OPPORTUNITIES.map((opp) => (
        <SignalNode key={opp.trackIdx} data={opp} sweepRef={sweepRef} />
      ))}
    </group>
  )
}

function ParticleField() {
  const ref = useRef<THREE.Points>(null)
  const count = 300

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.random() * 8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02
      ref.current.rotation.x += delta * 0.01
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={CYAN}
        transparent
        opacity={0.3}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function CameraRig() {
  const { camera, pointer } = useThree()
  useFrame(() => {
    // Subtle parallax
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.5, 0.02)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, 6 + pointer.y * 0.5, 0.02)
    camera.lookAt(0, 0, 0)
  })
  return null
}

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return !!gl
  } catch {
    return false
  }
}

export function RadarScene() {
  const [webglOk, setWebglOk] = useState(true)
  const [ready, setReady] = useState(false)
  const sweepRef = useRef(0)

  useEffect(() => {
    setWebglOk(detectWebGL())
  }, [])

  if (!webglOk) return <CSSRadarFallback />

  return (
    <div className="absolute inset-0 z-0 h-full w-full">
      <Canvas
        camera={{ position: [0, 6, 9], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onCreated={() => setReady(true)}
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 1s ease-in' }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 5, 0]} intensity={2} color={CYAN} />
        
        <Suspense fallback={null}>
          <CameraRig />
          <ParticleField />
          <group position={[-0.5, -0.2, 0]} rotation={[0, 0, 0]}>
            <RadarRings />
            <RadarSweep sweepRef={sweepRef} />
            <OpportunityNodes sweepRef={sweepRef} />
          </group>
        </Suspense>
      </Canvas>
    </div>
  )
}
