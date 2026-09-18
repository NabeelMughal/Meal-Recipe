'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Clock, ChefHat, Users, ExternalLink } from 'lucide-react'
import { FullScreenLoading } from '@/components/full-screen-loading'
import { ImageSlideshow } from '@/components/image-slideshow'
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

  if (loading) return <FullScreenLoading show message="Loading recipe..." />

  if (!recipe) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 text-center">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
          <p className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recipe unavailable</p>
          <h1 className="mt-4 font-serif text-4xl text-foreground">Recipe not found.</h1>
          <p className="mt-3 text-sm text-muted-foreground">This shared recipe link may be invalid, expired, or private.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            <ArrowLeft size={15} /> Back to cookbook
          </Link>
        </div>
      </main>
    )
  }

  const ingredients = [...(recipe.ingredients ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
  const instructions = [...(recipe.instructions ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))

  let images: string[] = Array.isArray(recipe.imageUrls) ? recipe.imageUrls.filter(Boolean) : []
  if (!images.length && recipe.image_url) {
    if (recipe.image_url.startsWith('[')) {
      try {
        const parsed = JSON.parse(recipe.image_url)
        images = Array.isArray(parsed) ? parsed.filter(Boolean) : []
      } catch {
        images = [recipe.image_url]
      }
    } else {
      images = [recipe.image_url]
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-border/30 px-5 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Cookbook
        </Link>
        <Link href="/" className="font-serif text-2xl">
          crumb<span className="text-primary">.</span>
        </Link>
      </header>

      <article className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            Shared recipe
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border/45 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
            <ChefHat size={12} /> <span className="capitalize">{recipe.difficulty ?? 'easy'} level</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border/45 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
            <Clock size={12} /> {Number(recipe.preparation_time ?? 0) + Number(recipe.cooking_time ?? 0)} min
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border/45 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
            <Users size={12} /> Serves {recipe.servings ?? 1}
          </span>
        </div>

        <h1 className="mt-5 font-serif text-4xl tracking-tight sm:text-6xl">{recipe.title}</h1>
        {recipe.description && (
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">{recipe.description}</p>
        )}

        <div className="mt-8 rounded-3xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
            <span className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">Recipe preview</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Read only <ExternalLink size={11} />
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            This is a public view of the recipe. It can be shared without sign in and does not include editing tools.
          </p>
        </div>

        {images.length > 0 && (
          <div className="mt-8">
            <ImageSlideshow images={images} />
          </div>
        )}

        <div className="mt-12 grid gap-12 border-t border-border/20 pt-10 lg:grid-cols-[0.9fr_1.1fr]">
          <section>
            <h2 className="border-b border-border pb-3 font-serif text-3xl">Ingredients</h2>
            <ul className="mt-5 space-y-3">
              {ingredients.map((item: any, index: number) => (
                <li key={item.id ?? `${item.name}-${index}`} className="flex items-start gap-3 rounded-2xl border border-border/40 bg-muted/20 p-3 text-sm text-muted-foreground">
                  <span className="mt-0.5 text-base text-primary">•</span>
                  <span>{[item.quantity, item.unit, item.name].filter(Boolean).join(' ')}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-5 border-b border-border pb-3 font-serif text-3xl">Method</h2>
            <ol className="flex flex-col gap-6">
              {instructions.map((item: any, index: number) => (
                <li key={item.id ?? `${item.instruction}-${index}`} className="flex gap-4 border-b border-border/20 pb-5 last:border-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="leading-relaxed text-foreground/90">{item.instruction}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </article>
    </main>
  )
}
