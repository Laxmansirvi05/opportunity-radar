'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useMemo, useRef, useState, useEffect, Suspense } from 'react'
import * as THREE from 'three'
import { CSSRadarFallback } from '@/components/landing/css-radar-fallback'

const ELECTRIC_BLUE = '#3b82f6'
const CYAN = '#38bdf8'
const PURPLE = '#a855f7'

const mod = (n: number, m: number) => ((n % m) + m) % m

/* ---------------------------------------------------------------- */
/* Rotating radar scan beam (a sweeping cone of light)              */
/* ---------------------------------------------------------------- */
function RadarSweep({ sweepRef }: { sweepRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y -= delta * 1.5 // Clockwise sweep
      sweepRef.current = ref.current.rotation.y
    }
  })

  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const radius = 2.4
    const segments = 32
    const arc = Math.PI / 3.5 
    shape.moveTo(0, 0)
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * arc
      shape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius)
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
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* leading edge line */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 0.015]} />
        <meshBasicMaterial color="#bfe6ff" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

/* ---------------------------------------------------------------- */
/* Concentric radar rings on the ground plane                       */
/* ---------------------------------------------------------------- */
function RadarRings() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {[0.55, 1.0, 1.5, 2.1, 2.7].map((r) => (
        <mesh key={r}>
          <ringGeometry args={[r - 0.003, r, 96]} />
          <meshBasicMaterial
            color={ELECTRIC_BLUE}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* Center dot */}
      <mesh>
        <circleGeometry args={[0.02, 16]} />
        <meshBasicMaterial color={CYAN} />
      </mesh>
    </group>
  )
}

/* ---------------------------------------------------------------- */
/* Opportunity signal nodes on the radar plane                      */
/* ---------------------------------------------------------------- */
const OPPORTUNITIES = [
  { title: 'Google SWE Internship', tag: 'Internship', color: CYAN },
  { title: 'Microsoft Internship', tag: 'Program', color: ELECTRIC_BLUE },
  { title: 'Global AI Hackathon', tag: 'Hackathon', color: PURPLE },
  { title: 'Research Scholarship', tag: 'Scholarship', color: '#60a5fa' },
  { title: 'Remote Developer Role', tag: 'Job', color: CYAN },
  { title: 'Data Science Competition', tag: 'Competition', color: PURPLE },
]

type Signal = {
  position: THREE.Vector3
  color: string
  phase: number
  cardData?: typeof OPPORTUNITIES[number]
}

function OpportunityNodes({ sweepRef }: { sweepRef: React.MutableRefObject<number> }) {
  const nodes = useMemo<Signal[]>(() => {
    const colors = [ELECTRIC_BLUE, CYAN, PURPLE, '#60a5fa']
    const out: Signal[] = []
    const count = 35
    let cardIdx = 0

    // To ensure cards don't overlap, we track used angles
    const usedAngles: number[] = []

    for (let i = 0; i < count; i++) {
      let isCard = false
      let cardData = undefined

      if (i % 6 === 0 && cardIdx < OPPORTUNITIES.length) {
        isCard = true
        cardData = OPPORTUNITIES[cardIdx]
        cardIdx++
      }

      let angle = 0
      let valid = false
      let attempts = 0
      
      while (!valid && attempts < 20) {
        angle = Math.random() * Math.PI * 2
        valid = true
        if (isCard) {
          for (const a of usedAngles) {
            if (Math.abs(mod(angle - a, Math.PI * 2)) < 0.8) {
              valid = false
              break
            }
          }
        }
        attempts++
      }
      
      if (isCard) usedAngles.push(angle)

      const radius = 0.4 + Math.random() * 2.0
      
      const v = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      )

      out.push({
        position: v,
        color: cardData ? cardData.color : colors[i % colors.length],
        phase: Math.random() * Math.PI * 2,
        cardData,
      })
    }
    return out
  }, [])

  return (
    <group>
      {nodes.map((n, i) => (
        <SignalNode key={i} signal={n} sweepRef={sweepRef} />
      ))}
    </group>
  )
}

function SignalNode({ signal, sweepRef }: { signal: Signal, sweepRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const activeUntil = useRef(0)
  const [isActive, setIsActive] = useState(false)
  
  const localAngle = useMemo(() => Math.atan2(signal.position.z, signal.position.x), [signal.position])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const sweep = sweepRef.current
    
    // Reverse math because sweep is rotating clockwise
    const worldAngle = localAngle
    const diff = mod(worldAngle - sweep, Math.PI * 2)
    
    if (diff > 0 && diff < 0.25) {
      activeUntil.current = t + 2.5 // Stay active for 2.5 seconds
      if (!isActive) setIsActive(true)
    } else if (t > activeUntil.current && isActive) {
      setIsActive(false)
    }

    const targetIntensity = isActive ? 1 : 0
    const currentIntensity = (ref.current as any).userData.intensity || 0
    const newIntensity = THREE.MathUtils.lerp(currentIntensity, targetIntensity, delta * 4)
    if (ref.current) (ref.current as any).userData.intensity = newIntensity

    const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + signal.phase)
    if (ref.current) {
      const s = 0.02 + pulse * 0.01 + newIntensity * 0.04
      ref.current.scale.setScalar(s)
      ;(ref.current.material as THREE.MeshBasicMaterial).color.set(signal.color).lerp(new THREE.Color('#ffffff'), newIntensity * 0.5)
    }
    
    if (glowRef.current) {
      const s = 0.04 + pulse * 0.04 + newIntensity * 0.15
      glowRef.current.scale.setScalar(s)
      ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        (0.25 * (1 - pulse)) + (newIntensity * 0.4)
    }
  })

  return (
    <group position={signal.position}>
      <mesh ref={ref}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={signal.color} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={signal.color}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {signal.cardData && (
        <CardBillboard data={signal.cardData} isActive={isActive} />
      )}
    </group>
  )
}

function CardBillboard({
  data,
  isActive
}: {
  data: typeof OPPORTUNITIES[0]
  isActive: boolean
}) {
  const ref = useRef<THREE.Group>(null)
  
  useFrame((state, delta) => {
    if (ref.current) {
      const cameraPosition = state.camera.position.clone()
      ref.current.parent?.worldToLocal(cameraPosition)
      ref.current.lookAt(cameraPosition)
      
      const targetOp = isActive ? 1 : 0
      const targetY = isActive ? 0.3 : 0.0
      
      const userData = ref.current.userData
      userData.op = THREE.MathUtils.lerp(userData.op || 0, targetOp, delta * 5)
      userData.y = THREE.MathUtils.lerp(userData.y || 0, targetY, delta * 5)
      
      ref.current.position.y = userData.y
      
      if (ref.current.children.length > 0) {
        const htmlElement = document.getElementById(`card-${data.title.replace(/\s/g, '')}`)
        if (htmlElement) {
          htmlElement.style.opacity = userData.op.toString()
          htmlElement.style.transform = `scale(${0.85 + userData.op * 0.15})`
          htmlElement.style.pointerEvents = isActive ? 'auto' : 'none'
        }
      }
    }
  })

  return (
    <group ref={ref}>
      <Html
        center
        transform
        distanceFactor={4.5}
        style={{ pointerEvents: 'none' }}
      >
        <div
          id={`card-${data.title.replace(/\s/g, '')}`}
          className="w-44 rounded-lg border border-white/10 px-3 py-2.5 shadow-2xl backdrop-blur-md transition-all duration-75"
          style={{ background: 'rgba(13, 24, 46, 0.92)', opacity: 0, transform: 'scale(0.85)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: data.color,
                boxShadow: `0 0 8px ${data.color}`,
              }}
            />
            <span
              className="font-mono text-[9px] uppercase tracking-widest"
              style={{ color: data.color }}
            >
              {data.tag}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium leading-snug text-foreground">
            {data.title}
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ---------------------------------------------------------------- */
/* Background particle field                                        */
/* ---------------------------------------------------------------- */
function ParticleField() {
  const ref = useRef<THREE.Points>(null)
  const count = 400

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.015
      ref.current.rotation.x += delta * 0.005
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        color={CYAN}
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/* ---------------------------------------------------------------- */
/* Mouse parallax rig                                               */
/* ---------------------------------------------------------------- */
function ParallaxRig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const { pointer } = useThree()

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.x = THREE.MathUtils.lerp(
        ref.current.rotation.x,
        pointer.y * 0.1,
        0.03,
      )
      ref.current.rotation.y = THREE.MathUtils.lerp(
        ref.current.rotation.y,
        pointer.x * 0.15,
        0.03,
      )
    }
  })

  return <group ref={ref}>{children}</group>
}

/* ---------------------------------------------------------------- */
/* Camera subtle parallax                                           */
/* ---------------------------------------------------------------- */
function CameraParallax() {
  const { camera, pointer } = useThree()
  useFrame(() => {
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      pointer.x * 0.3,
      0.03,
    )
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      1 + pointer.y * 0.2,
      0.03,
    )
    camera.lookAt(0, 0, 0)
  })
  return null
}

/* ---------------------------------------------------------------- */
/* WebGL support detection                                          */
/* ---------------------------------------------------------------- */
function detectWebGL(): boolean {
  return true;
}

/* ---------------------------------------------------------------- */
/* Main exported scene                                              */
/* ---------------------------------------------------------------- */
export function RadarScene() {
  const [ready, setReady] = useState(false)
  const [webglOk, setWebglOk] = useState<boolean>(true)
  
  const sweepRef = useRef(0)

  useEffect(() => {
    const isOk = detectWebGL()
    if (!isOk) {
      setWebglOk(false)
    }
  }, [])

  if (!webglOk) {
    return <CSSRadarFallback />
  }

  return (
    <Canvas
      camera={{ position: [0, 4, 6.5], fov: 42 }}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      onCreated={() => setReady(true)}
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 1.5s ease-out' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color={CYAN} />
      <pointLight position={[-5, -3, -5]} intensity={1.0} color={PURPLE} />

      <Suspense fallback={null}>
        <CameraParallax />
        <ParallaxRig>
          <ParticleField />
          {/* Tilt the entire radar plane forward to give it a cool isometric 3D perspective */}
          <group position={[0, 0, 0]} rotation={[0, 0, 0]}>
            <RadarRings />
            <RadarSweep sweepRef={sweepRef} />
            <OpportunityNodes sweepRef={sweepRef} />
          </group>
        </ParallaxRig>
      </Suspense>
    </Canvas>
  )
}
