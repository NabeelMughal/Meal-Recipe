import { auth, db } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, updateProfile } from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore'

function user() { return auth.currentUser }
function rows(name: string) { return collection(db, name) }

export function createClient() {
  const authApi = {
    getUser: async () => ({ data: { user: user() } }),
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => { try { const result = await signInWithEmailAndPassword(auth, email, password); return { data: { user: result.user }, error: null } } catch (error: any) { return { data: { user: null }, error } } },
    signUp: async ({ email, password, options }: any) => { try { const result = await createUserWithEmailAndPassword(auth, email, password); if (options?.data?.full_name) await updateProfile(result.user, { displayName: options.data.full_name }); await setDoc(doc(db, 'profiles', result.user.uid), { full_name: options?.data?.full_name ?? '', email }); return { data: { user: result.user }, error: null } } catch (error: any) { return { data: { user: null }, error } } },
    signOut: () => signOut(auth),
    updateUser: ({ password }: { password?: string }) => password && auth.currentUser ? updatePassword(auth.currentUser, password).then(() => ({ error: null })) : Promise.resolve({ error: null }),
    onAuthStateChange: (callback: (event: string, user: any) => void) => onAuthStateChanged(auth, value => callback('SIGNED_IN', value)),
  }
  return { auth: authApi, from: (name: string) => firestoreTable(name) }
}

function firestoreTable(name: string) {
  let filters: Array<[string, string, unknown]> = []
  let sort: string | undefined
  const builder: any = {
    select: () => builder,
    eq: (field: string, op: unknown) => { filters.push([field, '==', op]); return builder },
    order: (field: string) => { sort = field; return builder },
    maybeSingle: async () => { const result = await execute(); return { data: result[0] ?? null, error: null } },
    single: async () => { const result = await execute(); return { data: result[0] ?? null, error: result[0] ? null : new Error('Not found') } },
    insert: (value: any) => ({ select: () => ({ single: async () => { const ref = await addDoc(rows(name), value); return { data: { id: ref.id, ...value }, error: null } } }), then: async (resolve: any) => resolve({ error: null }) }),
    update: (value: any) => ({ eq: (field: string, value2: unknown) => ({ eq: async (field2: string, value3: unknown) => { const found = await execute([[field, '==', value2], [field2, '==', value3]]); if (found[0]?.id) await updateDoc(doc(db, name, found[0].id), value); return { error: null } } }) }),
    delete: () => ({ eq: (field: string, value: unknown) => ({ eq: async (field2: string, value2: unknown) => { const found = await execute([[field, '==', value], [field2, '==', value2]]); await Promise.all(found.map(item => deleteDoc(doc(db, name, item.id)))); return { error: null } } }) }),
  }
  async function execute(extra: Array<[string, string, unknown]> = []) { const constraints = [...filters, ...extra].map(([field, op, value]) => where(field, op as any, value)); const snap = await getDocs(query(rows(name), ...constraints, ...(sort ? [orderBy(sort)] : []))); return snap.docs.map(item => ({ id: item.id, ...item.data() })) }
  return builder
}
