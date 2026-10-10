import { useEffect, useState } from 'react'

/** 订阅媒体查询，随视口变化实时更新 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const sync = () => setMatches(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [query])

  return matches
}

/**
 * 紧凑布局（手机竖屏及以下）：
 * 左侧竖排工具条改为底部横排、样式栏不再换行堆叠、顶部栏只保留高频操作。
 */
export function useCompactLayout(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
