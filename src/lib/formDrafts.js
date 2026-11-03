const prefix = 'repuestospro:form-draft:'
let generation = 0

export function draftGeneration() { return generation }

export function clearFormDrafts({ all = false } = {}) {
  generation += 1
  try {
    for (const key of Object.keys(sessionStorage)) {
      const currentRoute = `${window.location.pathname}${window.location.search}`
      if (key.startsWith(prefix) && (all || key.endsWith(`:${currentRoute}`))) sessionStorage.removeItem(key)
    }
  } catch { /* Storage may be unavailable. */ }
}
