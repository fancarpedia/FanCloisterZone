import isNil from 'lodash/isNil'

const findPlayerIndex = (state, name) => {
  return state.players.findIndex(p => p.name === name)
}

// -------------------- Points Assert --------------------
class PointsAssert {
  constructor(state) {
    this.REGEXP = /(\w+) has (-?\d+) points?/
    this.state = state
  }

  verify(assertion) {
    const m = this.REGEXP.exec(assertion)
    if (m) {
      const player = this.state.players[findPlayerIndex(this.state, m[1])]
      const points = parseInt(m[2])
      return { result: player.points === points }
    }
  }
}

// -------------------- Feature Scored Assert --------------------
class FeatureScoredAssert {
  constructor(state) {
    this.REGEXP = /(\w+) scored ([\w-]+) for (-?\d+) points?/
    this.state = state
  }

  verify(assertion) {
    const m = this.REGEXP.exec(assertion)
    if (m) {
      const playerIdx = findPlayerIndex(this.state, m[1])
      const feature = m[2]
      const points = parseInt(m[3])

      if (!this.state.history) return { result: false }

      const result = !!this.state.history
        .flatMap(h => h.events)
        .filter(({ type }) => type === 'points')
        .flatMap(ev => ev.points)
        .find(
          pts =>
            pts.player === playerIdx &&
            pts.points === points &&
            pts.name.split('.')[0] === feature
        )

      return { result }
    }
  }
}

// -------------------- Pass Assert --------------------
class PassAssert {
  constructor(state) {
    this.state = state
  }

  verify(assertion) {
    if (assertion === "Player can't pass") return { result: !this.state.action.canPass }
    if (assertion === 'Player can pass') return { result: this.state.action.canPass }
  }
}

// -------------------- Phase Assert --------------------
class PhaseAssert {
  constructor(state) {
    this.REGEXP = /phase is (\w+)/i
    this.state = state
  }

  verify(assertion) {
    const m = this.REGEXP.exec(assertion)
    if (m) return { result: this.state.phase === m[1] }
  }
}

// -------------------- Available Action Assert --------------------
class AvailableActionAssert {
  constructor(state) {
    this.state = state
    this.REGEXP = /^Available action\s+(\S+)(?:\s+for\s+(\S+))?$/
  }

  verify(assertion) {
    const m = this.REGEXP.exec(assertion)
    if (!m) return

    const actionType = m[1]
    const forId = m[2]

    // Find items of this action type
    const items = this.state.action.items.filter(a => a.type === actionType)
    if (!items.length) return { result: false }
    
    if (forId) {
      // Try to match 'tileId', 'token', or 'meeple' properties
      const match = items.find(
        a => a.tileId === forId || a.token === forId || a.meeple === forId
      )
      return { result: !!match }
    }

    // No 'forId' needed, just check if action exists
    return { result: true }
    
  }
}

// -------------------- Tile Placement Options Assert --------------------
class TilePlacementOptionsAssert {
  constructor(state) {
    // Capture tileId (\S+ = any non-space) and everything after "options:"
    this.REGEXP = /^TilePlacement (\S+) options: (.*)$/
    this.state = state
  }

  posKey([x, y]) {
    return `${x},${y}`
  }

  arraysEqualUnordered(a, b) {
    if (!a || !b) return false
    if (a.length !== b.length) return false

    const map = new Map()
    for (const v of a) map.set(v, (map.get(v) || 0) + 1)
    for (const v of b) {
      if (!map.has(v)) return false
      map.set(v, map.get(v) - 1)
      if (map.get(v) === 0) map.delete(v)
    }
    return map.size === 0
  }

  indexByPosition(arr) {
    const map = new Map()
    for (const item of arr) map.set(this.posKey(item.position), item)
    return map
  }

  compareOptions(expected, actual) {
    const errors = []

    const expectedMap = this.indexByPosition(expected)
    const actualMap = this.indexByPosition(actual)

    for (const [key, exp] of expectedMap) {
      if (!actualMap.has(key)) {
        errors.push({ type: 'missing', position: exp.position, expectedRotations: exp.rotations })
        continue
      }

      const act = actualMap.get(key)
      if (!this.arraysEqualUnordered(exp.rotations, act.rotations)) {
        errors.push({
          type: 'rotation-mismatch',
          position: exp.position,
          expectedRotations: exp.rotations,
          actualRotations: act.rotations
        })
      }
    }

    for (const [key, act] of actualMap) {
      if (!expectedMap.has(key)) {
        errors.push({ type: 'extra', position: act.position, actualRotations: act.rotations })
      }
    }

    return errors
  }

  verify(assertion) {
    const m = this.REGEXP.exec(assertion)
    if (!m) return

    const tileId = m[1]
    const positionsStr = m[2]

    // Parse expected positions and rotations
    const ENTRY = /\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]\s*-\s*\[\s*([-\d,\s]+?)\s*\]/g
    const expected = []

    for (const match of positionsStr.matchAll(ENTRY)) {
      expected.push({
        position: [Number(match[1]), Number(match[2])],
        rotations: match[3].split(',').map(v => Number(v.trim()))
      })
    }

    // Find the TilePlacement item for this tileId
    const tilePlacement = this.state.action.items.find(
      a => a.type === 'TilePlacement' && a.tileId === tileId
    )

    if (!tilePlacement || !Array.isArray(tilePlacement.options)) {
      return { result: false }
    }

    const errors = this.compareOptions(expected, tilePlacement.options)

    if (errors.length === 0) return { result: true }

    console.log('Tile placement assert errors:', errors)
    return { result: false }
  }
}


// -------------------- Undo Assert --------------------
class UndoAssert {
  constructor(state) {
    this.state = state
  }

  verify(assertion) {
    if (assertion === 'Undo is not allowed') return { result: !this.state.undo.allowed }
    if (assertion === 'Undo is allowed') return { result: this.state.undo.allowed }
  }
}

// -------------------- Tunnel Token Placement Options --------------------
class TunnelTokenPlacementOptionsAssert {
  constructor(state) {
    this.state = state
    this.REGEXP = /^Tunnel token (\w+) options: (.*)$/
  }

  optionsEqual(a, b) {
    return (
      a.feature === b.feature &&
      a.location === b.location &&
      a.position.length === b.position.length &&
      a.position.every((v, i) => v === b.position[i])
    )
  }

  arraysEqualUnordered(a, b) {
    if (a.length !== b.length) return false
    const used = new Array(b.length).fill(false)
    for (const optionA of a) {
      let found = false
      for (let i = 0; i < b.length; i++) {
        if (!used[i] && this.optionsEqual(optionA, b[i])) {
          used[i] = true
          found = true
          break
        }
      }
      if (!found) return false
    }
    return true
  }

  verify(assertion) {
    const m = this.REGEXP.exec(assertion)
    if (!m) return

    const token = m[1]
    const optionsStr = m[2]

    const optionRegex = /\{([^,]+),([^,]+),\[\s*([^\]]*?)\s*\]\}/g
    const expectedOptions = []

    for (const match of optionsStr.matchAll(optionRegex)) {
      expectedOptions.push({
        feature: match[1].trim(),
        location: match[2].trim(),
        position: match[3].split(',').map(v => Number(v.trim()))
      })
    }

    const actual = this.state.action.items.find(item => item.token === token)
    if (!actual) return { result: false }

    return { result: this.arraysEqualUnordered(expectedOptions, actual.options) }
  }
}

// -------------------- Ferries Placement Options --------------------
class FerriesPlacementOptionsAssert {
  constructor(state) {
    this.state = state
    this.REGEXP = /^Ferries options:\s*(.*)$/
  }

  optionsEqual(a, b) {
    return (
      a.feature === b.feature &&
      a.location === b.location &&
      a.position.length === b.position.length &&
      a.position.every((v, i) => v === b.position[i])
    )
  }

  arraysEqualUnordered(a, b) {
    if (a.length !== b.length) return false
    const used = new Array(b.length).fill(false)
    for (const optionA of a) {
      let found = false
      for (let i = 0; i < b.length; i++) {
        if (!used[i] && this.optionsEqual(optionA, b[i])) {
          used[i] = true
          found = true
          break
        }
      }
      if (!found) return false
    }
    return true
  }

  verify(assertion) {
    const m = this.REGEXP.exec(assertion)
    if (!m) return

    const optionRegex = /\{([^,]+),([^,]+),\[\s*([^\]]*?)\s*\]\}/g
    const expectedOptions = []

    for (const match of m[1].matchAll(optionRegex)) {
      expectedOptions.push({
        feature: match[1].trim(),
        location: match[2].trim(),
        position: match[3].split(',').map(v => Number(v.trim()))
      })
    }

    const actual = this.state.action.items.find(item => item.type === 'Ferries')
    if (!actual) return { result: false }

    return { result: this.arraysEqualUnordered(expectedOptions, actual.options) }
  }
}

// -------------------- Meeple Placement Options --------------------
class MeeplePlacementOptionsAssert {
  constructor(state) {
    this.state = state
    this.REGEXP = /^Meeple (\w+) options: (.*)$/
  }

  optionsEqual(a, b) {
    return (
      a.feature === b.feature &&
      a.location === b.location &&
      a.position.length === b.position.length &&
      a.position.every((v, i) => v === b.position[i])
    )
  }

  arraysEqualUnordered(a, b) {
    if (a.length !== b.length) return false
    const used = new Array(b.length).fill(false)
    for (const optionA of a) {
      let found = false
      for (let i = 0; i < b.length; i++) {
        if (!used[i] && this.optionsEqual(optionA, b[i])) {
          used[i] = true
          found = true
          break
        }
      }
      if (!found) return false
    }
    return true
  }

  verify(assertion) {
    const m = this.REGEXP.exec(assertion)
    if (!m) return

    const meeple = m[1]
    const optionsStr = m[2]

    const optionRegex = /\{([^,]+),([^,]+),\[\s*([^\]]*?)\s*\]\}/g
    const expectedOptions = []

    for (const match of optionsStr.matchAll(optionRegex)) {
      expectedOptions.push({
        feature: match[1].trim(),
        location: match[2].trim(),
        position: match[3].split(',').map(v => Number(v.trim()))
      })
    }

    const actual = this.state.action.items.find(item => item.meeple === meeple)
    if (!actual) return { result: false }

    return { result: this.arraysEqualUnordered(expectedOptions, actual.options) }
  }
}

// -------------------- Main verification function --------------------
export function verifyScenario(state, { description, assertions }) {
  const result = { description, assertions: [] }

  const rules = [
    new PointsAssert(state),
    new FeatureScoredAssert(state),
    new PassAssert(state),
    new PhaseAssert(state),
    new AvailableActionAssert(state),
    new TilePlacementOptionsAssert(state),
    new UndoAssert(state),
    new TunnelTokenPlacementOptionsAssert(state),
    new FerriesPlacementOptionsAssert(state),
    new MeeplePlacementOptionsAssert(state)
  ]

  for (const assertion of assertions) {
    let assertionResult = null

    for (const rule of rules) {
      const ruleResult = rule.verify(assertion)
      if (!isNil(ruleResult)) {
        assertionResult = { assertion, ...ruleResult }
        break
      }
    }

    if (assertionResult === null) {
      assertionResult = { assertion, error: 'Unknown assertion', result: false }
    }

    result.assertions.push(assertionResult)
  }

  return result
}
