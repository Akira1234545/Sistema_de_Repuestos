import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import { draftGeneration } from '../lib/formDrafts.js'

// Opt-in only: never persists credentials, admin settings, or arbitrary DOM fields.
export function useFormDraft(initialValues) {
  const { user } = useAuth()
  const { pathname, search } = useLocation()
  const key = `repuestospro:form-draft:v2:${user?.id}:${pathname}${search}`
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
      if (user?.id && saved?.expires > Date.now() && saved.values && typeof saved.values === 'object') {
        return Object.fromEntries(Object.entries(initialValues).map(([name, value]) => [name,
          typeof saved.values[name] === typeof value ? saved.values[name] : value]))
      }
    } catch { /* Use server/default values if storage is unavailable. */ }
    return initialValues
  })
  useEffect(() => {
    if (!user?.id) return
    const generation = draftGeneration()
    const timer = setTimeout(() => {
      if (generation !== draftGeneration()) return
      try { sessionStorage.setItem(key, JSON.stringify({ expires: Date.now() + 86400000, values: form })) }
      catch { /* Drafts are best effort. */ }
    }, 250)
    return () => clearTimeout(timer)
  }, [key, form, user?.id])
  return [form, setForm]
}
