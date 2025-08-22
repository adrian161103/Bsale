export function groupBy<T, K extends keyof any>(
  array: T[],
  keyGetter: (item: T) => K
): Record<K, T[]> {
  return array.reduce((result, currentItem) => {
    const key = keyGetter(currentItem)
    result[key] = result[key] || []
    result[key].push(currentItem)
    return result
  }, {} as Record<K, T[]>)
}
