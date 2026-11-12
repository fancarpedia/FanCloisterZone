// The courier ghosts shown while hovering its move or the points that move scored:
//  - where it came FROM (the letter symbol on its first move, else beside the meeple it stood at);
//  - where it went TO, beside the meeple it walked to — only when it has since moved on, since
//    otherwise the real courier is standing right there.
// `from` / `to` are plain feature pointers { position, feature, location }; `stillThere(ptr)` tells
// whether the courier is currently deployed at that spot.

// on the letter tile the courier stands on the symbol itself; everywhere else it is beside a meeple
const besideMeeple = p => p.feature !== 'CourierLetter'

export const courierGhosts = (from, to, stillThere = () => false) => {
  const ghosts = []
  if (from && from.position) {
    ghosts.push({ figure: 'courier', ptr: from, nextToMeeple: besideMeeple(from) })
  }
  if (to && to.position && !stillThere(to)) {
    ghosts.push({ figure: 'courier', ptr: to, nextToMeeple: besideMeeple(to) })
  }
  return ghosts
}
