'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RecipeHome } from '@/components/recipe-home'
import { FullScreenLoading } from '@/components/full-screen-loading'
import { listRecipes } from '@/lib/recipes'
import { useAuthGuard } from '@/lib/use-auth-guard'

export default function Page() {
  const router = useRouter()
  const { user, authLoading } = useAuthGuard()
  const [recipes, setRecipes] = useState<any[]>([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth/login')
      return
    }

    let active = true
    setLoadError('')
    listRecipes()
      .then((items) => {
        if (active) setRecipes(items)
      })
      .catch((error: unknown) => {
        console.error('Failed to load recipes:', error)
        if (active) setLoadError('We could not load your recipes. Please try again.')
      })

    return () => { active = false }
  }, [authLoading, router, user])

  if (authLoading || !user) {
    return <FullScreenLoading show message="Restoring your kitchen..." />
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-4">
          <h1 className="font-serif text-3xl">Your kitchen is temporarily unavailable.</h1>
          <p className="text-muted-foreground">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </main>
    )
  }

  return <RecipeHome recipes={recipes} email={user.email ?? 'Your kitchen'} userId={user.uid} />
}
