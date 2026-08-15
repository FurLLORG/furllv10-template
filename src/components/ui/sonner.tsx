import { Toaster as Sonner, ToasterProps } from 'sonner'
import { useTheme } from '@/context/theme-provider'

const TOAST_POSITIONS = new Set([
  'bottom-right',
  'top-right',
  'top-center',
  'center',
])

type ToastPosition = NonNullable<ToasterProps['position']> | 'center'

export function getToastPosition(
  value = import.meta.env.VITE_TOAST_POSITION
): ToastPosition {
  return TOAST_POSITIONS.has(value) ? (value as ToastPosition) : 'bottom-right'
}

export function Toaster({ style, ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme()
  const position = getToastPosition()

  return (
    <Sonner
      position={position === 'center' ? 'top-center' : position}
      theme={theme as ToasterProps['theme']}
      richColors
      closeButton
      className={`toaster group [&_div[data-content]]:w-full${
        position === 'center' ? ' toaster-center' : ''
      }`}
      toastOptions={{
        className: 'app-toast',
      }}
      style={
        {
          '--width': 'min(calc(100vw - 32px), 420px)',
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          ...style,
          zIndex: 99999,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
