'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Clock, ChefHat, Users } from 'lucide-react'
import { RecipeActions } from '@/components/recipe-actions'
import { InteractiveIngredients } from '@/components/interactive-ingredients'
import { ImageSlideshow } from '@/components/image-slideshow'
import { FullScreenLoading } from '@/components/full-screen-loading'
import { useAuthGuard } from '@/lib/use-auth-guard'
import { getRecipe } from '@/lib/recipes'

export default function RecipePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, authLoading } = useAuthGuard()
  const [recipe, setRecipe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user || !id) return

    let cancelled = false
    async function loadRecipe() {
      setLoading(true)
      try {
        // getRecipe handles the ordered subcollection queries independently and
        // falls back to client-side sorting when an index is unavailable.
        const data = await getRecipe(id)
        if (!cancelled) setRecipe(data ?? null)
      } catch (error: any) {
        console.error('Recipe detail fetch failed:', {
          code: error?.code ?? 'unknown',
          message: error?.message ?? String(error),
        })
        if (!cancelled) setRecipe(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadRecipe()
    return () => { cancelled = true }
  }, [authLoading, id, user])

  if (authLoading || loading) return <FullScreenLoading show message="Opening recipe..." />
  if (!user) return <main className="flex min-h-screen items-center justify-center bg-background px-5 text-center"><div><h1 className="font-serif text-4xl">Sign in to view recipes.</h1><button onClick={() => router.push('/?auth=login')} className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">Go to sign in</button></div></main>
  if (!recipe) return <main className="flex min-h-screen items-center justify-center bg-background"><div className="text-center"><h1 className="font-serif text-4xl">Recipe not found.</h1><Link href="/" className="mt-6 inline-block text-sm text-primary">Back to cookbook</Link></div></main>

  const ingredients = [...(recipe.ingredients ?? [])].sort((a: any, b: any) => a.position - b.position)
  const instructions = [...(recipe.instructions ?? [])].sort((a: any, b: any) => a.position - b.position)
  const categoryName = Array.isArray(recipe.categories) ? recipe.categories[0]?.name : recipe.categories?.name
  const images = recipe.image_url?.startsWith('[') ? JSON.parse(recipe.image_url) : recipe.image_url ? [recipe.image_url] : []

  return <main className="min-h-screen bg-background text-foreground"><header className="mx-auto flex max-w-5xl items-center justify-between border-b border-border/30 px-5 py-6 sm:px-10"><Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Cookbook</Link><Link href="/" className="font-serif text-2xl">crumb<span className="text-primary">.</span></Link></header><article className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-10"><div className="flex flex-wrap items-center gap-3">{categoryName && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">{categoryName}</span>}<span className="flex items-center gap-1.5 rounded-full border border-border/45 bg-muted/60 px-3 py-1 text-xs text-muted-foreground"><ChefHat size={12} /> <span className="capitalize">{recipe.difficulty} level</span></span><span className="flex items-center gap-1.5 rounded-full border border-border/45 bg-muted/60 px-3 py-1 text-xs text-muted-foreground"><Clock size={12} /> {recipe.preparation_time + recipe.cooking_time} min</span><span className="flex items-center gap-1.5 rounded-full border border-border/45 bg-muted/60 px-3 py-1 text-xs text-muted-foreground"><Users size={12} /> Serves {recipe.servings}</span></div><h1 className="mt-5 font-serif text-4xl tracking-tight sm:text-6xl">{recipe.title}</h1>{recipe.description && <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">{recipe.description}</p>}<div className="mt-8 border-y border-border/60 py-4"><RecipeActions recipeId={recipe.id} title={recipe.title} description={recipe.description} ingredients={ingredients} instructions={instructions} prep={recipe.preparation_time} cook={recipe.cooking_time} servings={recipe.servings} difficulty={recipe.difficulty} imageUrl={recipe.image_url} /></div><ImageSlideshow images={images} /><div className="mt-12 grid gap-12 border-t border-border/20 pt-10 lg:grid-cols-[0.9fr_1.1fr]"><section><h2 className="border-b border-border pb-3 font-serif text-3xl">Ingredients</h2><InteractiveIngredients ingredients={ingredients} /></section><section><h2 className="mb-5 border-b border-border pb-3 font-serif text-3xl">Method</h2><ol className="flex flex-col gap-6">{instructions.map((item: any, index: number) => <li key={item.id ?? index} className="flex gap-4 border-b border-border/20 pb-5 last:border-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{index + 1}</span><p className="leading-relaxed">{item.instruction}</p></li>)}</ol></section></div></article></main>
}
