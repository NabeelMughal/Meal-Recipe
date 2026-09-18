'use client'

import { useState } from 'react'
import { Copy, Download, Printer, Share2, Edit, Trash2, Check, Loader2, BookOpen, X } from 'lucide-react'
import { pdf, Document, Page, Text, Image, View, StyleSheet } from '@react-pdf/renderer'
import { useRouter } from 'next/navigation'
import { deleteRecipe } from '@/lib/recipes'
import Link from 'next/link'
import { FullScreenLoading } from './full-screen-loading'

type Props = { 
  recipeId: string
  title: string 
  description?: string | null 
  ingredients: Array<{ name: string; quantity?: string; unit?: string }> 
  instructions: Array<{ instruction: string }> 
  prep?: number
  cook?: number
  servings?: number
  difficulty?: string
  imageUrl?: string | null
}

const styles = StyleSheet.create({ 
  page: { padding: 36, fontSize: 10, color: '#33302c', fontFamily: 'Helvetica' }, 
  header: { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0ede6', paddingBottom: 12 },
  brand: { fontSize: 8, color: '#8c7e6c', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 22, color: '#40301d', fontWeight: 'bold', marginBottom: 6, lineHeight: 1.25 },
  description: { fontSize: 9, color: '#666159', fontStyle: 'italic', lineHeight: 1.3, marginBottom: 8 },
  recipeImage: { width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 12 },
  metaRow: { flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: '#f5f2eb', paddingBottom: 8, marginBottom: 10, flexWrap: 'wrap' },
  metaItem: { fontSize: 8, color: '#8c7e6c', lineHeight: 1.3 },
  section: { fontSize: 12, color: '#40301d', fontWeight: 'bold', marginTop: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e8e5dc', paddingBottom: 3 },
  listItem: { marginBottom: 4, lineHeight: 1.3, flexDirection: 'row' },
  listBullet: { width: 12, fontSize: 10, color: '#8c7e6c', lineHeight: 1.3 },
  listText: { flex: 1, fontSize: 9, lineHeight: 1.35 },
  stepNumber: { width: 18, fontSize: 9, color: '#8c7e6c', fontWeight: 'bold', lineHeight: 1.35 }
})

function resolveRecipeImageUrl(rawImageUrl?: string | null) {
  if (!rawImageUrl) return ''

  if (rawImageUrl.startsWith('[')) {
    try {
      const parsed = JSON.parse(rawImageUrl)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const firstValue = parsed.find((value) => typeof value === 'string' && value.trim())
        return typeof firstValue === 'string' ? firstValue : ''
      }
    } catch {
      return rawImageUrl
    }
  }

  return rawImageUrl
}

async function resolvePdfImageSource(rawImageUrl?: string | null) {
  const resolved = resolveRecipeImageUrl(rawImageUrl)
  if (!resolved) return ''

  try {
    const response = await fetch(resolved)
    if (!response.ok) return resolved

    const blob = await response.blob()
    if (!blob.type || blob.size === 0) return resolved

    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result ?? resolved))
      reader.onerror = () => resolve(resolved)
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn('Image conversion for PDF export failed, using original URL fallback:', error)
    return resolved
  }
}

function RecipeDocument({ title, description, ingredients, instructions, prep = 0, cook = 0, servings = 1, difficulty = 'easy', imageUrl }: Omit<Props, 'recipeId'>) { 
  const firstImage = resolveRecipeImageUrl(imageUrl)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.brand}>crumb. Cookbook</Text>
          <Text style={styles.title}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>

        {/* Cover Photo */}
        {firstImage && <Image src={firstImage} style={styles.recipeImage} />}

        {/* Meta Stats */}
        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>DIFFICULTY: {difficulty.toUpperCase()}</Text>
          <Text style={styles.metaItem}>PREP: {prep} MINS</Text>
          <Text style={styles.metaItem}>COOK: {cook} MINS</Text>
          <Text style={styles.metaItem}>SERVINGS: {servings}</Text>
        </View>
        
        {/* Ingredients Block */}
        <Text style={styles.section}>Ingredients</Text>
        {ingredients.map((item, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={styles.listBullet}>•</Text>
            <Text style={styles.listText}>
              {[item.quantity, item.unit, item.name].filter(Boolean).join(' ')}
            </Text>
          </View>
        ))}
        
        {/* Steps Block */}
        <Text style={styles.section}>Method</Text>
        {instructions.map((item, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={styles.stepNumber}>{index + 1}.</Text>
            <Text style={styles.listText}>{item.instruction}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}

export function RecipeActions({ 
  recipeId, 
  title, 
  description, 
  ingredients, 
  instructions,
  prep = 0,
  cook = 0,
  servings = 1,
  difficulty = 'easy',
  imageUrl = null
}: Props) { 
  const router = useRouter()
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Share action
  async function share() { 
    const url = `${window.location.origin}/share/${recipeId}`
    if (navigator.share) { 
      try { 
        await navigator.share({ 
          title: title, 
          text: description ?? 'A recipe from crumb.', 
          url 
        }) 
      } catch (err) {
        console.error(err)
      } 
    } else { 
      await navigator.clipboard.writeText(url)
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2200)
    } 
  } 

  // PDF download action
  async function download() { 
    setDownloadBusy(true) 
    try { 
      const pdfImageUrl = await resolvePdfImageSource(imageUrl)
      const blob = await pdf(
        <RecipeDocument 
          title={title} 
          description={description} 
          ingredients={ingredients} 
          instructions={instructions}
          prep={prep}
          cook={cook}
          servings={servings}
          difficulty={difficulty}
          imageUrl={pdfImageUrl}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
      anchor.click()
      URL.revokeObjectURL(url) 
    } catch (err) { 
      console.error(err)
      window.alert('Could not create the PDF. Try printing instead.') 
    } finally { 
      setDownloadBusy(false) 
    } 
  } 

  // Delete recipe action
  async function remove() {
    if (!window.confirm('Delete this recipe? This cannot be undone.')) return
    setDeleteBusy(true)
    try {
      await deleteRecipe(recipeId)
      router.push('/')
      router.refresh()
    } catch (err: any) {
      window.alert('Could not delete recipe: ' + err.message)
      setDeleteBusy(false)
    }
  }

  // Copy link action
  async function handleCopy() {
    await navigator.clipboard.writeText(`${window.location.origin}/share/${recipeId}`)
    setCopied(true)
    setShareToast(true)
    setTimeout(() => {
      setCopied(false)
      setShareToast(false)
    }, 2200)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 max-w-full print:hidden">
      <FullScreenLoading show={deleteBusy} message="Deleting recipe..." />
      <FullScreenLoading show={downloadBusy} message="Preparing PDF download..." />
      {shareToast && (
        <div className="fixed right-4 top-4 z-[60] rounded-full border border-primary/20 bg-card px-4 py-2 text-sm text-foreground shadow-lg">
          Public recipe link copied to clipboard!
        </div>
      )}
      
      {/* Edit Recipe Button */}
      <Link 
        href={`/recipes/${recipeId}/edit`}
        className="flex items-center gap-2 rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-all duration-200"
      >
        <Edit size={14} /> 
        <span className="hidden sm:inline">Edit</span>
      </Link>

      {/* Delete Recipe Button */}
      <button 
        onClick={remove} 
        disabled={deleteBusy}
        className="flex items-center gap-2 rounded-full border border-destructive/20 bg-card hover:bg-destructive/5 text-destructive/80 hover:text-destructive px-3 py-2 text-sm disabled:opacity-50 transition-all duration-200"
      >
        {deleteBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        <span className="hidden sm:inline">{deleteBusy ? 'Deleting…' : 'Delete'}</span>
      </button>

      <span className="h-6 w-px bg-border/60 mx-1 hidden sm:inline" />

      {/* Quick Preview Button */}
      <button 
        onClick={() => setIsPreviewOpen(true)}
        className="flex items-center gap-2 rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-all duration-200"
      >
        <BookOpen size={14} /> 
        <span>Preview</span>
      </button>

      {/* Share Button */}
      <button 
        onClick={share} 
        className="flex items-center gap-2 rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-all duration-200"
      >
        <Share2 size={14} /> 
        <span>Share</span>
      </button>

      {/* Print Button */}
      <button 
        onClick={() => window.print()} 
        className="flex items-center gap-2 rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-all duration-200"
      >
        <Printer size={14} /> 
        <span className="hidden md:inline">Print</span>
      </button>

      {/* PDF Download Button */}
      <button 
        onClick={download} 
        disabled={downloadBusy} 
        className="flex items-center gap-2 rounded-full bg-primary hover:bg-primary/95 text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-60 transition-all duration-200 shadow-sm"
      >
        {downloadBusy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Download size={14} />
        )}
        <span>PDF</span>
      </button>

      {/* Copy Link Button */}
      <button 
        onClick={handleCopy} 
        aria-label="Copy recipe link" 
        className="rounded-full border border-border bg-card hover:bg-muted p-2 text-muted-foreground hover:text-foreground transition-all duration-200"
      >
        {copied ? (
          <Check size={14} className="text-primary animate-in zoom-in duration-200" />
        ) : (
          <Copy size={14} />
        )}
      </button>

      {/* Quick Preview Modal overlay */}
      {isPreviewOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div 
            className="w-full max-w-lg rounded-3xl bg-card border border-border p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto cursor-default animate-in zoom-in-95 duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
              <span className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">Recipe Summary</span>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 hover:bg-muted rounded-full transition-colors"
                aria-label="Close summary modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Title & Description */}
            <h2 className="font-serif text-2xl text-foreground font-semibold leading-tight">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-2 leading-relaxed italic">{description}</p>}
            
            {/* Meta tags badges */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-mono font-semibold uppercase tracking-wider border border-primary/20">
                Difficulty: {difficulty}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-mono font-semibold uppercase tracking-wider">
                Prep: {prep} mins
              </span>
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-mono font-semibold uppercase tracking-wider">
                Cook: {cook} mins
              </span>
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px] font-mono font-semibold uppercase tracking-wider">
                {servings} Servings
              </span>
            </div>

            {/* Quick Ingredients */}
            <div className="mt-6">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-1 mb-2 font-mono">Ingredients List</h3>
              <ul className="text-xs text-muted-foreground flex flex-col gap-1.5 pl-1">
                {ingredients.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="text-primary font-bold text-[10px]">•</span>
                    <span>{[item.quantity, item.unit, item.name].filter(Boolean).join(' ')}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Steps */}
            <div className="mt-5">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-1 mb-2 font-mono">Method Overview</h3>
              <ol className="text-xs text-muted-foreground flex flex-col gap-2.5 pl-1">
                {instructions.map((item, idx) => (
                  <li key={idx} className="flex gap-2 items-start">
                    <span className="font-semibold text-primary font-mono text-[10px] shrink-0 mt-0.5">{idx + 1}.</span>
                    <span className="leading-relaxed">{item.instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

    </div>
  ) 
}
