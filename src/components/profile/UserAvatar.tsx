'use client'

import { useState } from 'react'

interface UserAvatarProps {
  photoUrl?: string | null
  displayName?: string | null
  size?: number
  style?: React.CSSProperties
}

export default function UserAvatar({ photoUrl, displayName, size = 40, style }: UserAvatarProps) {
  const [err, setErr] = useState(false)
  const initials = displayName ? displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'
  const showPhoto = photoUrl && !err
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      background: showPhoto ? 'transparent' : 'linear-gradient(135deg,#7c3aed,#db2777)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid rgba(124,58,237,0.3)', ...style }}>
      {showPhoto
        ? <img src={photoUrl} alt={displayName ?? ''} onError={() => setErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ color: '#fff', fontSize: size * 0.38, fontWeight: 700,
            fontFamily: 'system-ui,sans-serif', lineHeight: 1, userSelect: 'none' }}>{initials}</span>}
    </div>
  )
}
