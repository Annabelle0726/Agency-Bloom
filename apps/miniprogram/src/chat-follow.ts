// Reader intent, independent of component selectors and native page rendering.
export function createChatFollow() {
  let following = true, highestTop = 0
  return {
    get following() { return following },
    pause() { following = false },
    scroll(top: number, nearBottom: boolean) {
      if (nearBottom) following = true
      else if (top < highestTop - 12) following = false
      highestTop = nearBottom ? top : Math.max(highestTop, top)
    },
    resume() { following = true; highestTop = 0 },
    reset() { following = true; highestTop = 0 },
  }
}
