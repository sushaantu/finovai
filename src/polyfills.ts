declare global {
  interface Window {
    global?: Window
  }
}

if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  window.global = window
}

export {}
