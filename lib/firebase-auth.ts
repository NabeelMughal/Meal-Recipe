import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, setDoc } from 'firebase/firestore'

export { auth, signOut }

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signUp(email: string, password: string, name: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName: name })
  await setDoc(doc(db, 'profiles', credential.user.uid), { full_name: name, email })
  return credential
}

export async function changePassword(email: string, oldPassword: string, newPassword: string) {
  const user = auth.currentUser
  if (!user || !user.email) throw new Error('Authentication required')
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, oldPassword))
  await updatePassword(user, newPassword)
}
