import { auth, db } from '@/lib/firebase'
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, where } from 'firebase/firestore'

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

function currentUser() {
  if (!auth.currentUser) throw new Error('Authentication required')
  return auth.currentUser
}

function recipeData(snapshot: any) {
  return snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() }))
}

function sortByPosition(items: any[]) {
  return items.sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
}

async function listRelated(collectionName: 'ingredients' | 'instructions', recipeId: string) {
  try {
    const snapshot = await getDocs(query(
      collection(db, collectionName),
      where('recipe_id', '==', recipeId),
      orderBy('position', 'asc'),
    ))
    return recipeData(snapshot)
  } catch (error: any) {
    console.error(`Failed to load ordered ${collectionName}:`, {
      code: error?.code ?? 'unknown',
      message: error?.message ?? String(error),
    })

    // A missing composite index should not make an otherwise valid recipe
    // disappear. Fetch the scoped documents and apply the ordering locally.
    try {
      const fallbackSnapshot = await getDocs(query(
        collection(db, collectionName),
        where('recipe_id', '==', recipeId),
      ))
      return sortByPosition(recipeData(fallbackSnapshot))
    } catch (fallbackError: any) {
      console.error(`Failed to load ${collectionName} fallback:`, {
        code: fallbackError?.code ?? 'unknown',
        message: fallbackError?.message ?? String(fallbackError),
      })
      // Related rows are supplementary. Keep the recipe usable when their
      // query is unavailable while preserving the base recipe document.
      return []
    }
  }
}

async function related(recipeId: string) {
  const [ingredients, instructions] = await Promise.all([
    listRelated('ingredients', recipeId),
    listRelated('instructions', recipeId),
  ])
  return { ingredients, instructions }
}

export async function listRecipes(userId?: string) {
  const user = auth.currentUser
  if (!user || (userId && user.uid !== userId)) return []

  let recipes: any[]
  try {
    const snapshot = await getDocs(query(collection(db, 'recipes'), where('user_id', '==', user.uid), orderBy('created_at', 'desc')))
    // An empty collection is a valid result, not a loading failure.
    recipes = snapshot.empty ? [] : recipeData(snapshot)
  } catch (error: any) {
    console.error('Failed to load ordered recipes:', {
      code: error?.code ?? 'unknown',
      message: error?.message ?? String(error),
    })

    const fallbackSnapshot = await getDocs(query(collection(db, 'recipes'), where('user_id', '==', user.uid)))
    recipes = recipeData(fallbackSnapshot).sort((a: any, b: any) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0
      const right = b.created_at ? new Date(b.created_at).getTime() : 0
      return right - left
    })
  }

  return Promise.all(recipes.map(async (recipe: any) => ({ ...recipe, ...(await related(recipe.id)) })))
}

export async function getRecipe(id: string) {
  const user = auth.currentUser
  if (!user) return null
  const snapshot = await getDocs(query(collection(db, 'recipes'), where('__name__', '==', id), where('user_id', '==', user.uid)))
  if (snapshot.empty) return null
  return { ...recipeData(snapshot)[0], ...(await related(id)) }
}

async function saveRelated(recipeId: string, input: RecipeInput) {
  const [oldIngredients, oldInstructions] = await Promise.all([
    getDocs(query(collection(db, 'ingredients'), where('recipe_id', '==', recipeId))),
    getDocs(query(collection(db, 'instructions'), where('recipe_id', '==', recipeId))),
  ])
  await Promise.all([...oldIngredients.docs, ...oldInstructions.docs].map((item) => deleteDoc(item.ref)))
  await Promise.all([
    ...input.ingredients.filter((item) => item.name.trim()).map((item, position) => addDoc(collection(db, 'ingredients'), { ...item, recipe_id: recipeId, name: item.name.trim(), position })),
    ...input.instructions.filter(Boolean).map((instruction, position) => addDoc(collection(db, 'instructions'), { recipe_id: recipeId, instruction: instruction.trim(), position })),
  ])
}

function recipePayload(userId: string, input: RecipeInput) {
  return {
    user_id: userId,
    title: input.title.trim(),
    description: input.description.trim(),
    preparation_time: input.preparation_time,
    cooking_time: input.cooking_time,
    servings: input.servings,
    difficulty: input.difficulty,
    category_id: input.category_id || null,
    image_url: input.image_url || null,
    created_at: new Date().toISOString(),
  }
}

export async function createRecipe(input: RecipeInput) {
  const user = currentUser()
  const payload = recipePayload(user.uid, input)
  const ref = await addDoc(collection(db, 'recipes'), payload)
  await saveRelated(ref.id, input)
  return { id: ref.id, ...payload }
}

export async function updateRecipe(id: string, input: RecipeInput) {
  const user = currentUser()
  const recipe = await getRecipe(id)
  if (!recipe || recipe.user_id !== user.uid) throw new Error('Recipe not found')
  await setDoc(doc(db, 'recipes', id), { ...recipePayload(user.uid, input), created_at: recipe.created_at }, { merge: true })
  await saveRelated(id, input)
  return { id, ...recipePayload(user.uid, input), created_at: recipe.created_at }
}

export async function deleteRecipe(id: string) {
  const user = currentUser()
  const recipe = await getRecipe(id)
  if (!recipe || recipe.user_id !== user.uid) throw new Error('Recipe not found')
  await deleteDoc(doc(db, 'recipes', id))
}

export async function listCategories() {
  const user = auth.currentUser
  if (!user) return []
  const snapshot = await getDocs(query(collection(db, 'categories'), where('user_id', '==', user.uid), orderBy('name', 'asc')))
  return recipeData(snapshot)
}

export async function createCategory(name: string) {
  const user = currentUser()
  const value = { user_id: user.uid, name: name.trim(), created_at: new Date().toISOString() }
  const ref = await addDoc(collection(db, 'categories'), value)
  return { id: ref.id, ...value }
}

export async function updateCategory(id: string, name: string) {
  const user = currentUser()
  const categories = await getDocs(query(collection(db, 'categories'), where('__name__', '==', id), where('user_id', '==', user.uid)))
  if (categories.empty) throw new Error('Category not found')
  await setDoc(doc(db, 'categories', id), { name: name.trim() }, { merge: true })
  return { id, ...categories.docs[0].data(), name: name.trim() }
}

export async function deleteCategory(id: string) {
  const user = currentUser()
  const categories = await getDocs(query(collection(db, 'categories'), where('__name__', '==', id), where('user_id', '==', user.uid)))
  if (categories.empty) throw new Error('Category not found')
  await deleteDoc(doc(db, 'categories', id))
}
