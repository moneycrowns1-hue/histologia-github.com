import { getSupabase, isSupabaseConfigured } from './supabaseClient.js'
import { getSavedImageBlob, idbUrlToKey, isIdbUrl } from './localImages.js'

const SLIDES_BUCKET = 'slides'

async function getRequiredSession(supabase) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const session = data?.session
  if (!session) throw new Error('No has iniciado sesión')
  return session
}

export async function cloudSendLoginEmail(email, redirectTo) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined
  })
  if (error) throw error
  return true
}

export async function cloudSignInWithPassword(email, password) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data?.user || null
}

export async function cloudHandleAuthRedirect() {
  if (!isSupabaseConfigured()) return false
  const supabase = getSupabase()
  if (!supabase) return false

  try {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    if (!code) return false

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error

    url.searchParams.delete('code')
    url.searchParams.delete('error')
    url.searchParams.delete('error_code')
    url.searchParams.delete('error_description')
    url.searchParams.delete('type')

    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
    return true
  } catch {
    return false
  }
}

export async function cloudSignOut() {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  return true
}

export async function cloudGetUser() {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data?.user || null
}

export async function cloudUpdateProfile({ role }) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const nextRole = String(role || '').trim()
  const { data, error } = await supabase.auth.updateUser({
    data: {
      role: nextRole
    }
  })
  if (error) throw error
  return data?.user || null
}

export function cloudOnAuthStateChange(callback) {
  if (!isSupabaseConfigured()) return () => {}
  const supabase = getSupabase()
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback?.(session?.user || null)
  })
  return () => {
    try {
      data?.subscription?.unsubscribe()
    } catch {
      // ignore
    }
  }
}

function safeExtFromType(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  if (t.includes('svg')) return 'svg'
  return 'jpg'
}

async function uploadBlobToBucket({ supabase, userId, blob, filenameBase }) {
  const ext = safeExtFromType(blob?.type)
  const path = `${userId}/${filenameBase}.${ext}`

  const { error: upErr } = await supabase.storage.from(SLIDES_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob?.type || undefined
  })
  if (upErr) throw upErr

  const { data } = supabase.storage.from(SLIDES_BUCKET).getPublicUrl(path)
  return { path, publicUrl: data?.publicUrl || '' }
}

export async function cloudIsReady() {
  return isSupabaseConfigured()
}

export async function cloudUpsertSlide(slide) {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const session = await getRequiredSession(supabase)
  const userId = session?.user?.id
  if (!userId) throw new Error('No user session')

  let nextSlide = { ...slide }

  if (isIdbUrl(slide?.imageUrl)) {
    const key = idbUrlToKey(slide.imageUrl)
    if (key) {
      const blob = await getSavedImageBlob(key)
      if (blob) {
        const uploaded = await uploadBlobToBucket({ supabase, userId, blob, filenameBase: slide.id })
        nextSlide = {
          ...nextSlide,
          imageUrl: uploaded.publicUrl,
          thumbnailUrl: uploaded.publicUrl
        }
      }
    }
  }

  const row = {
    id: nextSlide.id,
    user_id: userId,
    title: nextSlide.title || '',
    topic: nextSlide.topic || '',
    description: nextSlide.description || '',
    image_url: nextSlide.imageUrl || '',
    thumbnail_url: nextSlide.thumbnailUrl || '',
    natural_size: nextSlide.naturalSize || null,
    hotspots: nextSlide.hotspots || []
  }

  const { error } = await supabase.from('slides').upsert(row, { onConflict: 'id' })
  if (error) throw error

  return nextSlide
}

export async function cloudListSlides() {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase not configured')

  const session = await getRequiredSession(supabase)
  const userId = session?.user?.id
  if (!userId) throw new Error('No user session')

  const { data, error } = await supabase
    .from('slides')
    .select('id,title,topic,description,image_url,thumbnail_url,natural_size,hotspots,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    topic: r.topic,
    description: r.description,
    imageUrl: r.image_url,
    thumbnailUrl: r.thumbnail_url,
    naturalSize: r.natural_size || undefined,
    hotspots: Array.isArray(r.hotspots) ? r.hotspots : []
  }))
}
