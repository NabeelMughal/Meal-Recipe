'use client'

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from './firebase'

const MAX_BYTES = 300 * 1024

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  let quality = 0.82
  let blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image compression failed')), 'image/jpeg', quality))
  while (blob.size > MAX_BYTES && quality > 0.35) {
    quality -= 0.08
    blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image compression failed')), 'image/jpeg', quality))
  }
  if (blob.size > MAX_BYTES) throw new Error('Please choose a smaller image')
  return blob
}

export async function uploadRecipePhoto(file: File, recipeId: string) {
  if (!auth.currentUser) throw new Error('Authentication required')
  const compressed = await compressImage(file)
  const imageRef = ref(storage, `recipes/${auth.currentUser.uid}/${recipeId}/${Date.now()}.jpg`)
  await uploadBytes(imageRef, compressed, { contentType: 'image/jpeg' })
  return getDownloadURL(imageRef)
}
