"use client"
import { Canvas } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"

export default function TestPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas camera={{ position: [0, 4, 6.5], fov: 42 }}>
        <Html
          center
          transform
          distanceFactor={4.5}
          position={new THREE.Vector3(0, 0, 0)}
        >
          <div
            id="test-card"
            className="w-44 px-3 py-2.5"
            style={{ background: 'red', color: 'white' }}
          >
            <p>Minimal Test Card</p>
          </div>
        </Html>
      </Canvas>
    </div>
  )
}
