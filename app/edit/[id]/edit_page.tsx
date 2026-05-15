'use client'

import { useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { SiteHeader } from '@/components/SiteHeader'
import { SheetEditor } from '@/components/SheetEditor'
import { DiceRoller } from '@/components/DiceRoller'
import { useAdmin } from '@/lib/admin'

export default function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  // Bug 3 fix: usar hydrated para evitar redirect falso antes da hidratação
  const { admin, hydrated } = useAdmin()
  const router = useRouter()

  useEffect(() => {
    if (hydrated && !admin) {
      router.push('/')
    }
  }, [admin, hydrated, router])

  if (!hydrated) return null // aguarda hidratação sem redirect falso
  if (!admin) return null

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full">
        <h1 className="font-serif text-3xl text-gradient mb-6">Editar Ficha</h1>
        <SheetEditor characterId={id} />
      </main>

      <DiceRoller />
    </div>
  )
}
