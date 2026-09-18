'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FullScreenLoading } from '@/components/full-screen-loading'
import { getPublicRecipe } from '@/lib/recipes'

export default function PublicRecipeSharePage() {
  const { id } = useParams<{ id: string }>()
  const [recipe, setRecipe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setRecipe(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadRecipe() {
      setLoading(true)
      try {
        const data = await getPublicRecipe(id)
        if (!cancelled) setRecipe(data ?? null)
      } catch (error: any) {
        console.error('Public recipe fetch failed:', {
          code: error?.code ?? 'unknown',
          message: error?.message ?? String(error),
        })
        if (!cancelled) setRecipe(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadRecipe()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f4f1] px-4">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-sm">
          <FullScreenLoading show message="Loading recipe..." />
        </div>
      </main>
    )
  }

  if (!recipe) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f4f1] px-4">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
            <span className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">Recipe Summary</span>
          </div>
          <h2 className="font-serif text-2xl text-foreground font-semibold leading-tight">Recipe not found.</h2>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">This shared recipe link may be invalid or no longer available.</p>
        </div>
      </main>
    )
  }

  const ingredients = [...(recipe.ingredients ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
  const instructions = [...(recipe.instructions ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4f1] px-4 py-10 sm:px-6">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-4 shadow-[0_18px_40px_rgba(20,15,12,0.08)] sm:p-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">Recipe Summary</span>
        </div>

        <h2 className="font-serif text-2xl text-foreground font-semibold leading-tight sm:text-[2rem]">{recipe.title}</h2>
        {recipe.description && <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">{recipe.description}</p>}

        <div className="flex flex-wrap gap-1.5 mt-4">
          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-mono font-semibold uppercase tracking-wider border border-primary/20">
            Difficulty: {recipe.difficulty ?? 'easy'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-mono font-semibold uppercase tracking-wider">
            Prep: {recipe.preparation_time ?? 0} mins
          </span>
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-mono font-semibold uppercase tracking-wider">
            Cook: {recipe.cooking_time ?? 0} mins
          </span>
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-mono font-semibold uppercase tracking-wider">
            {recipe.servings ?? 1} Servings
          </span>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-1 mb-2 font-mono">Ingredients List</h3>
          <ul className="text-xs text-muted-foreground flex flex-col gap-1.5 pl-1">
            {ingredients.map((item: any, idx: number) => (
              <li key={item.id ?? `${item.name}-${idx}`} className="flex items-center gap-1.5">
                <span className="text-primary font-bold text-[10px]">•</span>
                <span>{[item.quantity, item.unit, item.name].filter(Boolean).join(' ')}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-1 mb-2 font-mono">Method Overview</h3>
          <ol className="text-xs text-muted-foreground flex flex-col gap-2.5 pl-1">
            {instructions.map((item: any, idx: number) => (
              <li key={item.id ?? `${item.instruction}-${idx}`} className="flex gap-2 items-start">
                <span className="font-semibold text-primary font-mono text-[10px] shrink-0 mt-0.5">{idx + 1}.</span>
                <span className="leading-relaxed">{item.instruction}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  )
}
