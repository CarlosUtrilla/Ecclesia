import icon from '../resources/icon.png'

const logoEl = document.getElementById('logo') as HTMLImageElement
if (logoEl) logoEl.src = icon
;(window as unknown as { updateStatus: (text: string) => void }).updateStatus = (text: string) => {
  const el = document.getElementById('status')
  if (!el) return
  el.style.opacity = '0'
  setTimeout(() => {
    el.textContent = text
    el.style.opacity = '1'
  }, 120)
}
