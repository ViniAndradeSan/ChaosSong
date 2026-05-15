'use client'

import ChaosCanvas from '@/components/ChaosCanvas'

export default function ChaosPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-8">Chaos Song - Canvas 2D</h1>
        <ChaosCanvas width={1200} height={800} />
      </div>
    </div>
  )
}