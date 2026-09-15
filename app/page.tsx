'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/firebase-client'
import { RecipeHome } from '@/components/recipe-home'
import { listRecipes } from '@/lib/recipes'

export default function Page() {
  const router = useRouter()
  const [account, setAccount] = useState<{ email: string; userId: string } | null>(null)
  const [recipes, setRecipes] = useState<any[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      const firebase = createClient()
      const { data: { user } } = await firebase.auth.getUser()
      if (!user) {
        router.replace('/auth/login')
        return
      }
      const items = await listRecipes()
      if (active) {
        setAccount({ email: user.email ?? 'Your kitchen', userId: user.uid })
        setRecipes(items)
      }
    }
    load()
    return () => { active = false }
  }, [router])

  if (!account) return <div className="min-h-screen bg-background" />
  return <RecipeHome recipes={recipes} email={account.email} userId={account.userId} />
}
