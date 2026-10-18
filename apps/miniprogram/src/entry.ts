export const OPENING_KEY = 'agency.opening.story.v1'
export type EntryScreen = 'restore' | 'opening' | 'auth' | 'onboard' | 'space'
export function initialScreen(hasSession: boolean, openingSeen: boolean): EntryScreen {
  return hasSession ? 'restore' : openingSeen ? 'auth' : 'opening'
}
export function signedInScreen(hasCurrent: boolean, hasHistory: boolean, paused: boolean): EntryScreen {
  return hasCurrent || hasHistory || paused ? 'space' : 'onboard'
}
export const draftKeyFor = (userId: string) => 'agency.onboarding.v3.' + userId
export const pauseKeyFor = (userId: string) => 'agency.onboarding.paused.v1.' + userId
export function questionStep(step?: number): number {
  return typeof step === 'number' && Number.isFinite(step) ? Math.max(0, Math.min(4, Math.floor(step))) : 0
}
