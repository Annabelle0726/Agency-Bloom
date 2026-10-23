// Reader intent, independent of component selectors and native page rendering.
export function createChatFollow() {
  let following = true, lastTop = 0
  return {
    get following() { return following },
    pause() { following = false },
    scroll(top: number, nearBottom: boolean) {
      if (nearBottom) following = true
      else if (top < lastTop - 12) following = false
      lastTop = top
    },
    resume() { following = true },
    reset() { following = true; lastTop = 0 },
  }
}
