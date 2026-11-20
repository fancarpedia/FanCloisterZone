// The name a Rules tab box (and its "i" dialog) shows for an element / base feature: normally
// game.feature.<id>; a few are named after what they bring rather than the piece itself — the
// shrine box is about the monastery / shrine challenge (a shrine alone scores like a monastery).
const TITLE_KEYS = {
  shrine: 'game.feature.shrine-challenge'
}

export const featureTitleKey = id => TITLE_KEYS[id] || 'game.feature.' + id
