import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import ToastStack from '../components/ToastStack'

const UiFeedbackContext = createContext(null)

export function UiFeedbackProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null)
  const [toasts, setToasts] = useState([])
  const timeouts = useRef(new Map())

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    setConfirmState({
      title: options.title || 'Confirm action',
      message: options.message || 'Are you sure you want to continue?',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      tone: options.tone || 'default',
      resolve,
    })
  }), [])

  const closeConfirm = useCallback((result) => {
    setConfirmState((prev) => {
      if (prev?.resolve) prev.resolve(result)
      return null
    })
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const timeoutId = timeouts.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeouts.current.delete(id)
    }
  }, [])

  const toast = useCallback((options = {}) => {
    const payload = typeof options === 'string' ? { message: options } : options
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const entry = {
      id,
      type: payload.type || 'info',
      title: payload.title || '',
      message: payload.message || 'Updated.',
    }

    setToasts((prev) => [...prev, entry])

    const duration = Number.isFinite(payload.duration) ? payload.duration : 4200
    const timeoutId = setTimeout(() => dismissToast(id), duration)
    timeouts.current.set(id, timeoutId)
  }, [dismissToast])

  useEffect(() => () => {
    timeouts.current.forEach((timeoutId) => clearTimeout(timeoutId))
    timeouts.current.clear()
  }, [])

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast])

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        tone={confirmState?.tone}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </UiFeedbackContext.Provider>
  )
}

export function useUiFeedback() {
  const ctx = useContext(UiFeedbackContext)
  if (!ctx) throw new Error('useUiFeedback must be used within UiFeedbackProvider')
  return ctx
}