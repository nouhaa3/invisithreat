// --- Profile Avatar Component (Reusable) ----------------------------------
import { useState } from 'react'

const ORANGE = '#FF6B2B'
const ORANGE_LIGHT = '#FF7A4D'

/**
 * ProfileAvatar - Displays user profile picture with fallback to initials
 * @param {Object} user - User object with nom, email, profile_picture, role_name
 * @param {number} size - Avatar size in pixels (default: 40)
 * @param {boolean} showInitials - Show initials as fallback (default: true)
 * @param {string} className - Additional CSS classes
 */
export function ProfileAvatar({ 
  user, 
  size = 40, 
  showInitials = true, 
  className = '',
  onClick = null 
}) {
  if (!user) return null

  const initials = (user.nom ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const hasImage = user.profile_picture && user.profile_picture.length > 0

  return (
    <div
      onClick={onClick}
      className={`relative flex-shrink-0 overflow-hidden flex items-center justify-center font-bold transition-transform ${onClick ? 'cursor-pointer hover:scale-110' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 8,
        backgroundImage: hasImage ? `url('${user.profile_picture}')` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: !hasImage ? 'rgba(255,107,43,0.15)' : 'transparent',
        border: '1px solid rgba(255,107,43,0.3)',
        color: ORANGE_LIGHT,
        fontSize: `${Math.max(10, size * 0.35)}px`,
      }}
      title={user.nom}
    >
      {!hasImage && showInitials && initials}
    </div>
  )
}

export default ProfileAvatar
