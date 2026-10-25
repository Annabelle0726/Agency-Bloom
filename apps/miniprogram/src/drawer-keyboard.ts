/** H5 uni-button hosts need keyboard semantics; native Mini Program buttons keep their own behavior. */
export function manageDrawerKeyboard(root: HTMLElement, close: () => void) {
  let keyboardNavigation = false
  const previous = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement : document.querySelector<HTMLElement>('[aria-label="打开会话列表"]')
  const decorate = () => {
    for (const button of Array.from(root.querySelectorAll<HTMLElement>('uni-button'))) {
      const disabled = button.hasAttribute('disabled')
      button.setAttribute('role', 'button')
      button.setAttribute('aria-disabled', String(disabled))
      button.tabIndex = disabled ? -1 : 0
    }
  }
  const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('uni-button,button,input,textarea,select,a[href],[tabindex="0"]'))
    .filter(el => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getClientRects().length > 0)
  const keydown = (event: KeyboardEvent) => {
    // Leave confirmation dialogs to the platform's own focus handling.
    if (Array.from(document.querySelectorAll('uni-modal')).some(el => el.getClientRects().length > 0)) return
    if (['Tab', 'Enter', ' ', 'Escape'].includes(event.key)) keyboardNavigation = true
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key === 'Tab') {
      const controls = focusable(), index = controls.indexOf(document.activeElement as HTMLElement)
      if (!controls.length) { event.preventDefault(); root.focus(); return }
      if (index < 0 || (!event.shiftKey && index === controls.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus()
      }
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLElement
      && event.target.tagName === 'UNI-BUTTON' && root.contains(event.target) && !event.target.hasAttribute('disabled')) {
      event.preventDefault(); event.target.click()
    }
  }
  root.setAttribute('aria-modal', 'true'); root.tabIndex = -1; root.style.outline = 'none'
  decorate()
  const observer = new MutationObserver(decorate)
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] })
  document.addEventListener('keydown', keydown, true)
  root.focus({ preventScroll: true })
  return () => {
    observer.disconnect(); document.removeEventListener('keydown', keydown, true)
    if (keyboardNavigation && previous?.isConnected) {
      if (previous.tagName === 'UNI-BUTTON') { previous.setAttribute('role', 'button'); previous.tabIndex = 0 }
      previous.focus({ preventScroll: true })
    }
  }
}
