'use client'

const MAX_BYTES = 300 * 1024

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  let quality = 0.82
  let blob = await renderJpeg(canvas, quality)
  while (blob.size > MAX_BYTES && quality > 0.35) {
    quality -= 0.08
    blob = await renderJpeg(canvas, quality)
  }
  if (blob.size > MAX_BYTES) throw new Error('Please choose a smaller image')
  return blob
}

function renderJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image compression failed')), 'image/jpeg', quality)
  })
}

export async function uploadRecipePhoto(file: File) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary upload is not configured')

  const compressed = await compressImage(file)
  const filename = `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
  const uploadFile = new File([compressed], filename, { type: 'image/jpeg' })
  const body = new FormData()
  body.append('file', uploadFile, filename)
  body.append('upload_preset', uploadPreset)
  body.append('folder', 'recipes')
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body })
  if (!response.ok) throw new Error('Image upload failed')
  const result = await response.json() as { secure_url?: string }
  if (!result.secure_url) throw new Error('Image upload returned no URL')
  return withRecipeImageTransform(result.secure_url)
}

function withRecipeImageTransform(url: string) {
  return url.replace('/upload/', '/upload/c_limit,w_800,h_800,q_auto,f_auto/')
}

export { compressImage }
