const TUTORIAL_COMPLETE_KEY = 'bindet:tutorial-complete'
const TUTORIAL_PENDING_KEY = 'bindet:tutorial-pending'

export function isTutorialComplete(): boolean {
  return localStorage.getItem(TUTORIAL_COMPLETE_KEY) === '1'
}

export function isTutorialPending(): boolean {
  return localStorage.getItem(TUTORIAL_PENDING_KEY) === '1'
}

export function startTutorial(): void {
  localStorage.setItem(TUTORIAL_PENDING_KEY, '1')
  window.location.hash = 'tools'
}

export function markTutorialComplete(): void {
  localStorage.setItem(TUTORIAL_COMPLETE_KEY, '1')
  localStorage.removeItem(TUTORIAL_PENDING_KEY)
  window.dispatchEvent(new Event('bindet:tutorial-complete'))
}
