import { useState, useEffect } from 'react'

/**
 * Hook that returns a relative time string that updates every second
 * E.g., "1m ago", "Just now", "3h ago", etc.
 * 
 * @param {string} isoDate - ISO date string from backend
 * @returns {string} Relative time string
 */
export function useRelativeTime(isoDate) {
  const [relativeTime, setRelativeTime] = useState('')

  useEffect(() => {
    // Initial computation
    const updateTime = () => {
      const diff = Date.now() - new Date(isoDate).getTime()
      let result

      if (diff < 60_000) result = 'Just now'
      else if (diff < 3_600_000) result = `${ Math.floor(diff / 60_000) }m ago`
      else if (diff < 86_400_000) result = `${ Math.floor(diff / 3_600_000) }h ago`
      else if (diff < 604_800_000) result = `${ Math.floor(diff / 86_400_000) }d ago`
      else result = new Date(isoDate).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })

      setRelativeTime(result)
    }

    // Update immediately
    updateTime()

    // Re-compute every second to keep it fresh
    const interval = setInterval(updateTime, 1_000)

    return () => clearInterval(interval)
  }, [isoDate])

  return relativeTime
}
