import { createClient } from '@/lib/firebase-client'

export type RecipeInput = {
  title: string
  description: string
  preparation_time: number
  cooking_time: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  ingredients: Array<{ name: string; quantity: string; unit: string; notes: string }>
  instructions: string[]
  category_id?: string | null
  image_url?: string | null
}

export async function listRecipes() {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) return []
  const { data } = await firebase.from('recipes').select('*, ingredients(*), instructions(*)').eq('user_id', user.uid).order('created_at', { ascending: false })
  return data ?? []
}

export async function getRecipe(id: string) {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) return null
  const { data } = await firebase.from('recipes').select('*, ingredients(*), instructions(*)').eq('id', id).eq('user_id', user.uid).maybeSingle()
  return data
}

export async function createRecipe(input: RecipeInput) {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) throw new Error('Authentication required')
  
  const { data: recipe, error } = await firebase
    .from('recipes')
    .insert({ 
      user_id: user.uid, 
      title: input.title.trim(), 
      description: input.description.trim(), 
      preparation_time: input.preparation_time, 
      cooking_time: input.cooking_time, 
      servings: input.servings, 
      difficulty: input.difficulty,
      category_id: input.category_id || null,
      image_url: input.image_url || null
    })
    .select()
    .single()
    
  if (error || !recipe) throw new Error(error?.message ?? 'Unable to create recipe')
  
  const ingredients = input.ingredients
    .filter((item) => item.name.trim())
    .map((item, position) => ({ ...item, recipe_id: recipe.id, name: item.name.trim(), position }))
    
  const instructions = input.instructions
    .filter(Boolean)
    .map((instruction, position) => ({ recipe_id: recipe.id, instruction: instruction.trim(), position }))
    
  if (ingredients.length) await firebase.from('ingredients').insert(ingredients)
  if (instructions.length) await firebase.from('instructions').insert(instructions)
  
  return recipe
}

export async function updateRecipe(id: string, input: RecipeInput) {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) throw new Error('Authentication required')
  
  const { error: recipeError } = await firebase
    .from('recipes')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      preparation_time: input.preparation_time,
      cooking_time: input.cooking_time,
      servings: input.servings,
      difficulty: input.difficulty,
      category_id: input.category_id || null,
      image_url: input.image_url || null
    })
    .eq('id', id)
    .eq('user_id', user.uid)
    
  if (recipeError) throw new Error(recipeError.message)
  
  // Re-insert ingredients
  await firebase.from('ingredients').delete().eq('recipe_id', id)
  const ingredients = input.ingredients
    .filter((item) => item.name.trim())
    .map((item, position) => ({ ...item, recipe_id: id, name: item.name.trim(), position }))
  if (ingredients.length) await firebase.from('ingredients').insert(ingredients)
  
  // Re-insert instructions
  await firebase.from('instructions').delete().eq('recipe_id', id)
  const instructions = input.instructions
    .filter(Boolean)
    .map((instruction, position) => ({ recipe_id: id, instruction: instruction.trim(), position }))
  if (instructions.length) await firebase.from('instructions').insert(instructions)
}

export async function deleteRecipe(id: string) {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) throw new Error('Authentication required')
  const { error } = await firebase.from('recipes').delete().eq('id', id).eq('user_id', user.uid)
  if (error) throw new Error(error.message)
}

// Category Operations
export async function listCategories() {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) return []
  const { data, error } = await firebase.from('categories').select('*').eq('user_id', user.uid).order('name', { ascending: true })
  if (error) {
    console.error('Error fetching categories:', error.message)
    return []
  }
  return data ?? []
}

export async function createCategory(name: string) {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) throw new Error('Authentication required')
  const { data, error } = await firebase.from('categories').insert({ user_id: user.uid, name: name.trim() }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateCategory(id: string, name: string) {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) throw new Error('Authentication required')
  const { data, error } = await firebase.from('categories').update({ name: name.trim() }).eq('id', id).eq('user_id', user.uid).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteCategory(id: string) {
  const firebase = await createClient()
  const { data: { user } } = await firebase.auth.getUser()
  if (!user) throw new Error('Authentication required')
  const { error } = await firebase.from('categories').delete().eq('id', id).eq('user_id', user.uid)
  if (error) throw new Error(error.message)
}
