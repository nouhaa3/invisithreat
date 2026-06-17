import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * SessionWarningPopup
 *
 * Fires at minute 29 of inactivity (AuthContext.inactivityWarning === true).
 * Displays a countdown from 60 s to 0, then auto-logs out.
 * "Stay logged in" calls recordActivity() which resets the idle timer.
 */
export default function SessionWarningPopup() {
  const { inactivityWarning, recordActivity, logout } = useAuth()
  const [secondsLeft, setSecondsLeft] = useState(60)
  const intervalRef = useRef(null)

  // Reset countdown every time the popup opens
  useEffect(() => {
    if (!inactivityWarning) {
      clearInterval(intervalRef.current)
      setSecondsLeft(60)
      return
    }

    setSecondsLeft(60)
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          logout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [inactivityWarning, logout])

  if (!inactivityWarning) return null

  const radius = 20
  const circ   = 2 * Math.PI * radius
  const dash   = (secondsLeft / 60) * circ
  const urgentColor = secondsLeft <= 15 ? '#f87171' : '#FF6B2B'

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-desc"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl p-6 flex flex-col gap-4 animate-slide-up"
        style={{
          background: 'linear-gradient(160deg, #111 0%, #0d0d0d 100%)',
          border: `1px solid ${secondsLeft <= 15 ? 'rgba(248,113,113,0.35)' : 'rgba(255,107,43,0.3)'}`,
          boxShadow: `0 0 40px ${secondsLeft <= 15 ? 'rgba(248,113,113,0.15)' : 'rgba(255,107,43,0.12)'}`,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Countdown ring */}
          <div className="flex-shrink-0">
            <svg width={52} height={52} viewBox="0 0 52 52">
              <circle cx={26} cy={26} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
              <circle
                cx={26} cy={26} r={radius} fill="none"
                stroke={urgentColor} strokeWidth={5}
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(-90 26 26)"
                style={{ transition: 'stroke-dasharray 0.9s linear, stroke 0.3s' }}
              />
              <text
                x={26} y={26}
                textAnchor="middle" dominantBaseline="central"
                fill={urgentColor} fontSize={13} fontWeight="700"
              >
                {secondsLeft}
              </text>
            </svg>
          </div>

          <div>
            <p
              id="session-warning-title"
              className="text-base font-bold text-white"
            >
              Session expiring soon
            </p>
            <p
              id="session-warning-desc"
              className="text-sm mt-0.5"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Please save your work. You'll be logged out automatically in{' '}
              <span style={{ color: urgentColor }} className="font-semibold tabular-nums">
                {secondsLeft}s
              </span>{' '}
              due to inactivity.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={recordActivity}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
            style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)' }}
          >
            Stay logged in
          </button>
          <button
            onClick={logout}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}
