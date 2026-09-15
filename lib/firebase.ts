import { getApps, getApp, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)
const app = getApps().length > 0
  ? getApp()
  : initializeApp(hasFirebaseConfig ? firebaseConfig : {
      apiKey: 'build-placeholder',
      authDomain: 'build-placeholder.firebaseapp.com',
      projectId: 'build-placeholder',
      messagingSenderId: '000000000000',
      appId: '1:000000000000:web:build-placeholder',
    })

export const auth = getAuth(app)
export const db = getFirestore(app)
