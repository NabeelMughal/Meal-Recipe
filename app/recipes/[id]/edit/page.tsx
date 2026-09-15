'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { RecipeEditor } from '@/components/recipe-editor'
import { FullScreenLoading } from '@/components/full-screen-loading'
import { useAuthGuard } from '@/lib/use-auth-guard'
import { createClient } from '@/lib/firebase-client'

export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, authLoading } = useAuthGuard()
  const [recipe, setRecipe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user || !id) return
    createClient().from('recipes').select('*, ingredients(*), instructions(*)').eq('id', id).eq('user_id', user.uid).maybeSingle().then(({ data }: { data: any }) => {
      if (!data) router.replace('/not-found')
      else {
        data.ingredients = [...(data.ingredients ?? [])].sort((a: any, b: any) => a.position - b.position)
        data.instructions = [...(data.instructions ?? [])].sort((a: any, b: any) => a.position - b.position)
        setRecipe(data)
      }
      setLoading(false)
    })
  }, [authLoading, id, router, user])

  if (authLoading || loading) return <FullScreenLoading show message="Loading recipe..." />
  if (!user) return <main className="flex min-h-screen items-center justify-center bg-background px-5 text-center"><div><h1 className="font-serif text-4xl">Sign in to edit recipes.</h1><button onClick={() => router.push('/?auth=login')} className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Go to sign in</button></div></main>
  if (!recipe) return null

  return <main className="min-h-screen bg-background text-foreground"><header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 sm:px-10 border-b border-border/50"><Link href={`/recipes/${recipe.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to recipe</Link><Link href="/" className="font-serif text-2xl">crumb<span className="text-primary">.</span></Link></header><section className="mx-auto max-w-4xl px-5 pb-20 pt-10 sm:px-10"><p className="eyebrow">Edit recipe</p><h1 className="mt-3 font-serif text-4xl sm:text-5xl tracking-tight">Refine the recipe details.</h1><p className="mt-4 max-w-xl leading-7 text-muted-foreground">Update the title, measurements, steps, or change its category.</p><div className="mt-10"><RecipeEditor recipe={recipe} /></div></section></main>
}
