import { useEffect, useRef } from 'react'

type LocalQrCodeProps = {
  value: string
  size?: number
  label: string
}

/** Generates QR modules locally in the browser; the encoded identifier is not sent to a QR image service. */
export function LocalQrCode({ value, size = 72, label }: LocalQrCodeProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.replaceChildren()
    const text = value.trim()
    if (!text) {
      host.textContent = 'No ID'
      return
    }

    type QRCodeOptions = {
      text: string
      width: number
      height: number
      colorDark: string
      colorLight: string
      correctLevel: number
    }
    type QRCodeConstructor = new (target: HTMLElement, options: QRCodeOptions) => unknown
    const QRCode = (window as Window & { QRCode?: QRCodeConstructor }).QRCode
    if (!QRCode) {
      host.textContent = 'QR unavailable'
      return
    }

    try {
      new QRCode(host, {
        text,
        width: size,
        height: size,
        colorDark: '#211832',
        colorLight: '#ffffff',
        correctLevel: 0,
      })
    } catch {
      host.textContent = 'QR unavailable'
    }

    return () => host.replaceChildren()
  }, [value, size])

  return <div
    ref={hostRef}
    className="ed360-local-qr"
    style={{ width: size, height: size }}
    role="img"
    aria-label={label}
  />
}
