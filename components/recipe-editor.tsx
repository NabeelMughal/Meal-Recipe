'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { createCategory, createRecipe, listCategories, updateRecipe } from '@/lib/recipes'
import { uploadRecipePhoto } from '@/lib/cloudinary'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Image as ImageIcon, Loader2, X, ArrowLeft, Sparkles } from 'lucide-react'
import { listCachedCategories } from '@/lib/offline-db'
import { FullScreenLoading } from './full-screen-loading'

// Client-side image compression to downscale and reduce file size
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        const MAX_DIM = 1200
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width)
            width = MAX_DIM
          } else {
            width = Math.round((width * MAX_DIM) / height)
            height = MAX_DIM
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75)
        resolve(compressedBase64)
      }
      img.onerror = () => reject(new Error('Failed to load image for compression.'))
      img.src = event.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

function normalizeDifficulty(value?: string) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'medium') return 'medium'
  if (normalized === 'hard') return 'hard'
  return 'easy'
}

type Ingredient = { name: string; quantity: string; unit: string; notes: string }

type Recipe = { 
  id: string
  title: string
  description?: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  preparation_time: number
  cooking_time: number
  servings: number
  category_id?: string | null
  imageUrls?: string[] | null
  image_url?: string | null
  ingredients?: Array<{ name: string; quantity: string; unit: string; notes?: string }>
  instructions?: Array<{ instruction: string }>
}

export function RecipeEditor({ recipe }: { recipe?: Recipe }) {
  const router = useRouter()
  const [title, setTitle] = useState(recipe?.title ?? '')
  const [description, setDescription] = useState(recipe?.description ?? '')
  const [prep, setPrep] = useState(String(recipe?.preparation_time ?? '10'))
  const [cook, setCook] = useState(String(recipe?.cooking_time ?? '20'))
  const [servings, setServings] = useState(String(recipe?.servings ?? '2'))
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(recipe?.difficulty ?? 'easy')
  const [categoryId, setCategoryId] = useState<string>(recipe?.category_id ?? '')
  
  // Multiple images state (backward-compatible)
  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    if (recipe?.imageUrls?.length) return recipe.imageUrls.filter(Boolean)
    if (!recipe?.image_url) return []
    if (recipe.image_url.startsWith('[')) {
      try {
        const parsed = JSON.parse(recipe.image_url)
        return Array.isArray(parsed) ? parsed.filter(Boolean) : []
      } catch {
        return [recipe.image_url]
      }
    }
    return [recipe.image_url]
  })
  const [pendingAiFiles, setPendingAiFiles] = useState<File[]>([])
  const [inputUrl, setInputUrl] = useState('')
  
  // Ingredients state setup (initialize with default structure, combining quantity, unit, and notes for edit mode)
  const initialIngredients = recipe?.ingredients && recipe.ingredients.length > 0 
    ? recipe.ingredients.map(item => {
        const parts = []
        if (item.quantity?.trim()) parts.push(item.quantity.trim())
        if (item.unit?.trim()) parts.push(item.unit.trim())
        if (item.notes?.trim()) parts.push(item.notes.trim())
        return {
          name: item.name,
          quantity: parts.join(' '),
          unit: '',
          notes: ''
        }
      })
    : [{ name: '', quantity: '', unit: '', notes: '' }]
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)
  
  // Instructions state setup
  const initialInstructions = recipe?.instructions && recipe.instructions.length > 0
    ? recipe.instructions.map(item => item.instruction)
    : ['']
  const [instructions, setInstructions] = useState<string[]>(initialInstructions)
  
  const [categories, setCategories] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [aiParsing, setAiParsing] = useState(false)
  const [aiError, setAiError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const aiFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [recipe?.id])

  // Warn on unsaved changes before leaving
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const isDirty = title.trim() || description.trim() || ingredients.some(i => i.name.trim()) || instructions.some(step => step.trim())
      if (isDirty && !busy) {
        e.preventDefault()
        e.returnValue = 'You have unsaved recipe changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [title, description, ingredients, instructions, busy])

  // Fetch user categories after Firebase Auth restores the session.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return
      if (!navigator.onLine) {
        const cached = await listCachedCategories(user.uid)
        setCategories(cached)
        return
      }
      try {
        setCategories(await listCategories())
      } catch (err) {
        console.error('Failed to load categories online:', err)
      }
    })
    return unsubscribe
  }, [])

  function updateIngredient(index: number, key: keyof Ingredient, value: string) {
    setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  }

  function applyParsedRecipe(data: any) {
    const parsedTitle = String(data?.title ?? '').trim()
    const parsedDescription = String(data?.description ?? '').trim()
    const parsedCategory = String(data?.category ?? '').trim()
    const parsedPrep = Number(data?.prepTime ?? data?.prep_time ?? 0)
    const parsedCook = Number(data?.cookTime ?? data?.cook_time ?? 0)
    const parsedServings = Number(data?.servings ?? 2)
    const parsedDifficulty = normalizeDifficulty(data?.difficulty)

    setTitle(parsedTitle || title || '')
    setDescription(parsedDescription || description || '')
    setPrep(String(Number.isFinite(parsedPrep) && parsedPrep > 0 ? parsedPrep : 0))
    setCook(String(Number.isFinite(parsedCook) && parsedCook > 0 ? parsedCook : 0))
    setServings(String(Number.isFinite(parsedServings) && parsedServings > 0 ? parsedServings : 2))
    setDifficulty(parsedDifficulty as 'easy' | 'medium' | 'hard')

    const suggestedIngredients = Array.isArray(data?.ingredients) && data.ingredients.length > 0
      ? data.ingredients.map((item: any) => ({
          name: String(item?.name ?? '').trim(),
          quantity: String(item?.notes ?? '').trim(),
          unit: '',
          notes: '',
        }))
      : [{ name: '', quantity: '', unit: '', notes: '' }]
    setIngredients(suggestedIngredients)

    const suggestedInstructions = Array.isArray(data?.instructions) && data.instructions.length > 0
      ? data.instructions.map((step: any) => String(step ?? '').trim()).filter(Boolean)
      : ['']
    setInstructions(suggestedInstructions.length ? suggestedInstructions : [''])

    const matchedCategory = categories.find((category) => category.name.toLowerCase() === parsedCategory.toLowerCase())
    if (matchedCategory) {
      setCategoryId(matchedCategory.id)
      setIsAddingCategory(false)
      setNewCategoryName('')
    } else if (parsedCategory) {
      setCategoryId('')
      setIsAddingCategory(true)
      setNewCategoryName(parsedCategory)
    } else {
      setCategoryId('')
      setIsAddingCategory(false)
      setNewCategoryName('')
    }
  }

  async function handleAiScanUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    if (!file.type.startsWith('image/')) {
      setAiError('Please upload a valid image file.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setAiError('')
    setAiParsing(true)
    setImageUrls((current) => [...current, previewUrl])
    setPendingAiFiles((current) => [...current, file])

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/parse-recipe', {
        method: 'POST',
        body: formData,
      })

      const responseData = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(responseData?.error || 'The AI scanner could not read this recipe.')
      }

      if (!responseData || typeof responseData !== 'object') {
        throw new Error('The recipe scan returned no data.')
      }

      applyParsedRecipe(responseData)
      setMessage('')
    } catch (err: any) {
      setImageUrls((current) => current.filter((url) => url !== previewUrl))
      setPendingAiFiles((current) => current.slice(0, -1))
      setAiError(err.message ?? 'Could not scan this photo.')
    } finally {
      setAiParsing(false)
    }
  }

  // Handle category creation inline
  async function handleAddCategory(e: React.MouseEvent) {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    setCategoryLoading(true)
    setMessage('')
    try {
      const user = auth.currentUser
      if (!user) {
        setMessage('Auth required.')
        setCategoryLoading(false)
        return
      }

      const data = await createCategory(newCategoryName.trim())
      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setCategoryId(data.id)
      setNewCategoryName('')
      setIsAddingCategory(false)
    } catch (err: any) {
      setMessage(err.message ?? 'Could not create category.')
    } finally {
      setCategoryLoading(false)
    }
  }

  // Handle multiple image uploads (with auto-compression using canvas)
  async function handleImageFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remainingSlots = Math.max(0, 5 - imageUrls.length)
    if (remainingSlots === 0) {
      setImageError('You can add up to 5 images per recipe.')
      e.currentTarget.value = ''
      return
    }
    const selectedFiles = files.slice(0, remainingSlots)
    if (files.length > remainingSlots) setImageError('Only the first 5 images were added.')
    setImageLoading(true)
    setImageError('')
    // Allow selecting the same file again and prevent stale input state from
    // carrying an upload into a different recipe form.
    e.currentTarget.value = ''

    try {
      const uploadedUrls = await Promise.all(selectedFiles.map((file) => uploadRecipePhoto(file)))
      setImageUrls((prev) => [...prev, ...uploadedUrls])
    } catch (err: any) {
      setImageError(err.message ?? 'Failed to process one or more images.')
    } finally {
      setImageLoading(false)
    }
  }

  // Add pasted URL
  function addPastedUrl(e: React.MouseEvent) {
    e.preventDefault()
    if (!inputUrl.trim()) return
    setImageUrls((prev) => [...prev, inputUrl.trim()])
    setInputUrl('')
    setImageError('')
  }

  async function uploadPendingAiImages() {
    if (!pendingAiFiles.length) return imageUrls.filter((url) => !url.startsWith('blob:'))

    const uploadedUrls = await Promise.all(pendingAiFiles.map((file) => uploadRecipePhoto(file)))
    const existingUrls = imageUrls.filter((url) => !url.startsWith('blob:'))
    const nextUrls = [...existingUrls, ...uploadedUrls].slice(0, 5)
    setImageUrls(nextUrls)
    setPendingAiFiles([])
    return nextUrls
  }

  // Submit recipe (Create or Update)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const user = auth.currentUser
      if (!user) {
        setMessage('Your session is still loading. Please try again.')
        setBusy(false)
        return
      }

      const finalImageUrls = await uploadPendingAiImages()
      const payload = {
        title: title.trim(),
        description: description.trim(),
        preparation_time: Number(prep) || 0,
        cooking_time: Number(cook) || 0,
        servings: Math.max(1, Number(servings) || 1),
        difficulty,
        category_id: categoryId || null,
        imageUrls: finalImageUrls.slice(0, 5),
        image_url: finalImageUrls.length > 0 ? JSON.stringify(finalImageUrls.slice(0, 5)) : null,
        ingredients,
        instructions,
      }
      const saved = recipe ? await updateRecipe(recipe.id, payload) : await createRecipe(payload)
      setImageUrls([])
      setInputUrl('')
      setPendingAiFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (aiFileInputRef.current) aiFileInputRef.current.value = ''
      window.alert(recipe ? 'Recipe updated.' : 'Recipe created.')
      router.push(recipe ? `/recipes/${saved?.id ?? recipe.id}` : '/')
    } catch (err: any) {
      console.error('Failed to save recipe:', err)
      setMessage(err.message ?? 'We could not save this recipe. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8 transition-all duration-300">
      <FullScreenLoading show={busy} message="Saving recipe to cookbook..." />
      <FullScreenLoading show={aiParsing} message="AI is scanning and translating your recipe into English..." />
      
      {/* Recipe Meta Section */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-foreground">Recipe details</div>
          <button
            type="button"
            onClick={() => aiFileInputRef.current?.click()}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/10"
          >
            <Sparkles size={16} className="text-primary" />
            Upload Recipe Photo for AI Auto-Fill
          </button>
          <input
            ref={aiFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAiScanUpload}
          />
        </div>

        {aiError && (
          <div className="md:col-span-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {aiError}
          </div>
        )}

        <label className="md:col-span-2">
          <span className="field-label">Recipe title</span>
          <input 
            required 
            value={title} 
            onChange={(event) => setTitle(event.target.value)} 
            placeholder="e.g. Lemon herb pasta" 
            className="field-input text-xl" 
          />
        </label>
        
        <label className="md:col-span-2">
          <span className="field-label">Description</span>
          <textarea 
            value={description} 
            onChange={(event) => setDescription(event.target.value)} 
            placeholder="What makes this recipe worth remembering?" 
            rows={3} 
            className="field-input resize-none" 
          />
        </label>

        {/* Category Picker & Inline Adder */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Category</span>
            {!isAddingCategory ? (
              <button 
                type="button" 
                onClick={() => setIsAddingCategory(true)} 
                className="text-xs font-medium text-primary hover:underline transition-all"
              >
                + Add New Category
              </button>
            ) : (
              <button 
                type="button" 
                onClick={() => setIsAddingCategory(false)} 
                className="text-xs font-medium text-muted-foreground hover:underline transition-all"
              >
                Cancel
              </button>
            )}
          </div>

          {!isAddingCategory ? (
            <select 
              value={categoryId} 
              onChange={(e) => setCategoryId(e.target.value)} 
              className="field-input"
            >
              <option value="">No Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <input 
                type="text" 
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)} 
                placeholder="Category name (e.g. Pasta, Desserts)" 
                className="field-input" 
                autoFocus
              />
              <button 
                type="button" 
                disabled={categoryLoading}
                onClick={handleAddCategory} 
                className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60 flex items-center gap-1 shrink-0 transition hover:bg-primary/95"
              >
                {categoryLoading ? <Loader2 size={16} className="animate-spin" /> : 'Add'}
              </button>
            </div>
          )}
        </div>

        {/* Image handling */}
        <div className="md:col-span-2">
          <span className="field-label">Recipe Images (Upload Multiple)</span>
          {imageError && (
            <div className="mt-1.5 text-xs text-destructive font-medium border border-destructive/20 bg-destructive/5 px-3 py-2 rounded-xl animate-in slide-in-from-top-1 duration-200">
              {imageError}
            </div>
          )}
          <div className="mt-2 flex flex-col gap-4">
            
            {/* Grid of uploaded images */}
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-2">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative group aspect-video overflow-hidden rounded-2xl border border-border bg-muted flex items-center justify-center shadow-sm animate-in fade-in duration-200">
                    <img 
                      src={url} 
                      alt={`Recipe preview ${idx + 1}`} 
                      className="w-full h-full object-cover" 
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        setImageUrls(prev => prev.filter((_, i) => i !== idx))
                        if (url.startsWith('blob:')) {
                          URL.revokeObjectURL(url)
                          setPendingAiFiles((prev) => prev.slice(0, -1))
                        }
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/85 rounded-full text-white transition-all shadow-md"
                      aria-label="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Area */}
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-6 bg-card hover:bg-muted/50 transition-colors relative">
              {imageLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-primary" size={32} />
                  <span className="text-sm text-muted-foreground">Reading files...</span>
                </div>
              ) : (
                <label htmlFor="image-upload" className="flex flex-col items-center gap-2 cursor-pointer w-full h-full text-center">
                  <ImageIcon size={36} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium">Click to upload recipe images (multiple allowed)</span>
                  <span className="text-xs text-muted-foreground">Supports PNG, JPG, WEBP (Auto-compressed to load instantly)</span>
                  <input 
                    type="file" 
                    id="image-upload" 
                    accept="image/*" 
                    multiple
                    className="hidden" 
                    onChange={handleImageFiles} 
                  />
                </label>
              )}
            </div>

            {/* Alternately paste image URL */}
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="text" 
                placeholder="Or paste direct image link (URL)" 
                value={inputUrl} 
                onChange={(e) => setInputUrl(e.target.value)} 
                className="flex-1 bg-transparent text-xs border-b border-border py-1 outline-none focus:border-primary transition"
              />
              <button 
                type="button" 
                onClick={addPastedUrl}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-xl text-xs font-semibold text-foreground transition-all"
              >
                Add URL
              </button>
            </div>
          </div>
        </div>

        <label>
          <span className="field-label">Prep time (mins)</span>
          <input 
            type="number" 
            min="0" 
            value={prep} 
            onChange={(event) => setPrep(event.target.value)} 
            className="field-input" 
          />
        </label>
        
        <label>
          <span className="field-label">Cook time (mins)</span>
          <input 
            type="number" 
            min="0" 
            value={cook} 
            onChange={(event) => setCook(event.target.value)} 
            className="field-input" 
          />
        </label>
        
        <label>
          <span className="field-label">Servings</span>
          <input 
            type="number" 
            min="1" 
            value={servings} 
            onChange={(event) => setServings(event.target.value)} 
            className="field-input" 
          />
        </label>
        
        <label>
          <span className="field-label">Difficulty</span>
          <select 
            value={difficulty} 
            onChange={(event) => setDifficulty(event.target.value as typeof difficulty)} 
            className="field-input"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>

      {/* Ingredients Section */}
      <section className="transition-all duration-300">
        <div className="mb-4">
          <h2 className="font-serif text-2xl">Ingredients</h2>
        </div>
        
        <div className="flex flex-col gap-3">
          {ingredients.map((item, index) => (
            <div 
              key={index} 
              className="grid gap-3 rounded-2xl border border-border bg-card p-4 grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-center transition-all animate-in fade-in duration-200"
            >
              <input 
                required={index === 0} 
                value={item.name} 
                onChange={(event) => updateIngredient(index, 'name', event.target.value)} 
                placeholder="Ingredient name" 
                className="field-input" 
              />
              <input 
                value={item.quantity} 
                onChange={(event) => updateIngredient(index, 'quantity', event.target.value)} 
                placeholder="Qty, unit or notes (e.g. 200g chopped)" 
                className="field-input" 
              />
              {ingredients.length > 1 && (
                <button 
                  type="button" 
                  aria-label="Remove ingredient" 
                  onClick={() => setIngredients(ingredients.filter((_, itemIndex) => itemIndex !== index))} 
                  className="self-center justify-self-center rounded-full p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}

          {/* Add ingredient button at the bottom, full width with a brown background */}
          <button 
            type="button" 
            onClick={() => setIngredients([...ingredients, { name: '', quantity: '', unit: '', notes: '' }])} 
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground py-3.5 px-4 font-semibold text-sm transition-all duration-200 shadow-sm active:scale-[0.99] mt-1"
          >
            <Plus size={16} /> Add ingredient
          </button>
        </div>
      </section>

      {/* Instructions Section */}
      <section className="transition-all duration-300">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Instructions</h2>
          <button 
            type="button" 
            onClick={() => setInstructions([...instructions, ''])} 
            className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline transition-all"
          >
            <Plus size={16} /> Add step
          </button>
        </div>
        
        <div className="flex flex-col gap-3">
          {instructions.map((item, index) => (
            <div key={index} className="flex gap-3 items-start transition-all animate-in fade-in duration-200">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm">
                {index + 1}
              </span>
              <div className="flex-1 flex gap-2 items-start">
                <textarea 
                  required={index === 0} 
                  value={item} 
                  onChange={(event) => setInstructions(instructions.map((step, stepIndex) => stepIndex === index ? event.target.value : step))} 
                  placeholder="Describe this step of the preparation..." 
                  rows={2} 
                  className="field-input resize-none flex-1" 
                />
                {instructions.length > 1 && (
                  <button 
                    type="button" 
                    aria-label="Remove step" 
                    onClick={() => setInstructions(instructions.filter((_, stepIndex) => stepIndex !== index))} 
                    className="p-2.5 mt-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {message && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium animate-shake">
          {message}
        </div>
      )}
      
      {/* Submit Button with Loading State */}
      <button 
        disabled={busy || imageLoading || aiParsing} 
        className="rounded-full bg-primary hover:bg-primary/95 active:scale-95 px-8 py-4 font-medium text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all duration-200"
      >
        {busy ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Saving recipe...
          </>
        ) : (
          'Save recipe'
        )}
      </button>
    </form>
  )
}
