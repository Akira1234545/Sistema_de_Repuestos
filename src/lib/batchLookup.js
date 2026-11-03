// Coalesces synchronous consumers by account/type without retaining private results.
export function createBatchLookup(load) {
  const batches = new Map()
  return (group, id) => new Promise((resolve, reject) => {
    let batch = batches.get(group)
    if (!batch) {
      batch = []
      batches.set(group, batch)
      queueMicrotask(async () => {
        batches.delete(group)
        try {
          const found = await load(group, [...new Set(batch.map(item => item.id))])
          for (const item of batch) item.resolve(found.has(item.id))
        } catch (error) { for (const item of batch) item.reject(error) }
      })
    }
    batch.push({ id, resolve, reject })
  })
}
