'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Loader2, Mail } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetBusy, setResetBusy] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(credential.user, { displayName: name })
      router.push('/auth/login')
      router.refresh()
    } catch (error: any) {
      setMessage(error?.code === 'auth/email-already-in-use' ? 'An account with that email already exists.' : 'Unable to create your account. Please check your details.')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setResetBusy(true)
    setMessage('')
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setResetSuccess(true)
      setTimeout(() => {
        setResetEmail('')
        setResetSuccess(false)
        setShowForgotPassword(false)
      }, 3000)
    } catch (err: any) {
      setMessage(err.message ?? 'Failed to send recovery email. Please check your email and try again.')
    } finally {
      setResetBusy(false)
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-6 sm:py-10 text-foreground overflow-x-hidden">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm transition-all duration-300">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          crumb<span className="text-primary">.</span>
        </Link>
        <p className="eyebrow mt-8 sm:mt-12">Join the table</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl tracking-tight leading-tight text-balance">
          Make your cookbook yours.
        </h1>
        
        {!showForgotPassword ? (
          <form onSubmit={submit} className="mt-6 sm:mt-8 flex flex-col gap-3.5">
            <label className="field-label">
              Your name
              <input required value={name} onChange={(e) => setName(e.target.value)} className="field-input mt-1.5" />
            </label>
            <label className="field-label">
              Email
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-input mt-1.5" />
            </label>
            <label className="field-label">
              Password
              <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field-input mt-1.5" />
            </label>
            
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-primary hover:underline font-medium transition-all"
              >
                Forgot password?
              </button>
            </div>

            {message && <p role="alert" className="text-sm text-destructive font-medium">{message}</p>}
            <button disabled={busy} className="rounded-full bg-primary hover:bg-primary/95 hover:shadow-sm px-5 py-3.5 font-medium text-primary-foreground disabled:opacity-60 active:scale-98 transition-all flex items-center justify-center gap-2">
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-6 sm:mt-8 flex flex-col gap-3.5 animate-in fade-in">
            {resetSuccess ? (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary">
                  <Mail size={20} />
                </div>
                <p className="text-sm font-medium text-foreground">Reset link sent!</p>
                <p className="text-xs text-muted-foreground">Check your email for password reset instructions.</p>
              </div>
            ) : (
              <>
                <label className="field-label">
                  Email Address
                  <input
                    required
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="field-input mt-1.5"
                    placeholder="name@example.com"
                  />
                </label>

                {message && <p role="alert" className="text-xs text-destructive font-medium border border-destructive/10 bg-destructive/5 p-3 rounded-xl">{message}</p>}

                <button
                  type="button"
                  disabled={resetBusy}
                  onClick={() => setShowForgotPassword(false)}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium transition-all"
                >
                  Back to sign up
                </button>

                <button
                  disabled={resetBusy}
                  className="rounded-full bg-primary hover:bg-primary/95 hover:shadow-sm px-5 py-3.5 font-medium text-primary-foreground disabled:opacity-60 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  {resetBusy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-xs sm:text-sm text-muted-foreground">
          Already have an account? <Link href="/auth/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
