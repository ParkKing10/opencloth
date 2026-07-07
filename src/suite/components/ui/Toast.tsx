import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IcoCheck, IcoBell, IcoSparkle } from './Icons'
import './toast.css'

export type ToastTone = 'default' | 'success' | 'accent' | 'info'

type ToastItem = { id: number; message: string; tone: ToastTone }

type ToastApi = (message: string, tone?: ToastTone) => void

const ToastContext = createContext<ToastApi>(() => {})

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

const TONE_ICON = {
  default: IcoCheck,
  success: IcoCheck,
  accent: IcoSparkle,
  info: IcoBell,
} as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const toast = useCallback<ToastApi>((message, tone = 'default') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3400)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="suite suite-toaster" role="status" aria-live="polite">
          {toasts.map((t) => {
            const Icon = TONE_ICON[t.tone]
            return (
              <div className={`toast toast--${t.tone}`} key={t.id}>
                <span className="toast__ico">
                  <Icon width="15" height="15" />
                </span>
                <span className="toast__msg">{t.message}</span>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
