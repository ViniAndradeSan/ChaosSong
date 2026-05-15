import { useState, useCallback } from 'react'

export type FloatItem = {
  id: string
  text: string
  color: string
  x?: number
}

export function useFloatingText() {
  const [floats, setFloats] = useState<FloatItem[]>([])

  const trigger = useCallback((text: string, color: string, x?: number) => {
    const id = crypto.randomUUID()
    setFloats((prev) => [...prev, { id, text, color, x }])
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 1600)
  }, [])

  return { floats, trigger }
}
