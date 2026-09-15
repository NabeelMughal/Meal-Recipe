'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/firebase-client'
import { AccountForm } from '@/components/account-form'

export default function AccountPage() {
  const router = useRouter()
  const [account, setAccount] = useState<{ email: string; userId: string; name: string } | null>(null)

  useEffect(() => {
    let active = true
    async function loadAccount() {
      const firebase = createClient()
      const { data: { user } } = await firebase.auth.getUser()
      if (!user) {
        router.replace('/?auth=login')
        return
      }
      const { data: profile } = await firebase.from('profiles').select('full_name').eq('id', user.uid).maybeSingle()
      if (active) setAccount({ email: user.email ?? '', userId: user.uid, name: profile?.full_name ?? '' })
    }
    loadAccount()
    return () => { active = false }
  }, [router])

  if (!account) return <div className="min-h-screen bg-background" />
  return <AccountForm email={account.email} initialName={account.name} userId={account.userId} />
}
