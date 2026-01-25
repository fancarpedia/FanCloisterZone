import isNil from 'lodash/isNil'

const findPlayerIndex = (state, name) => {
  return state.players.findIndex(p => p.name === name)
}

class PointsAssert {
  constructor (state) {
    this.REGEXP = /(\w+) has (-?\d+) points?/
    this.state = state
  }

  verify (assertion) {
    const m = this.REGEXP.exec(assertion)
    if (m) {
      const player = this.state.players[findPlayerIndex(this.state, m[1])]
      const points = parseInt(m[2])
      return { result: player.points === points }
    }
  }
}

class FeatureScoredAssert {
  constructor (state) {
    this.REGEXP = /(\w+) scored ([\w-]+) for (-?\d+) points?/
    this.state = state
  }

  verify (assertion) {
    const m = this.REGEXP.exec(assertion)
    if (m) {
      const playerIdx = findPlayerIndex(this.state, m[1])
      const feature = m[2]
      const points = parseInt(m[3])

      if (!this.state.history) {
        return { result: false }
      }

      const result = !!this.state.history
        .flatMap(h => h.events)
        .filter(({ type }) => type === 'points')
        .flatMap(ev => ev.points)
        .find(pts => pts.player === playerIdx && pts.points === points && pts.name.split('.')[0] === feature)

      return { result }
    }
  }
}

class PassAssert {
  constructor (state) {
    this.state = state
  }

  verify (assertion) {
    if (assertion === "Player can't pass") {
      return { result: !this.state.action.canPass }
    }
    if (assertion === 'Player can pass') {
      return { result: this.state.action.canPass }
    }
  }
}

class PhaseAssert {
  constructor (state) {
    this.REGEXP = /phase is (\w+)/
    this.state = state
  }

  verify (assertion) {
    const m = this.REGEXP.exec(assertion)
    if (m) {
      return { result: this.state.phase === m[1]}
    }
  }
}

class AvailableActionAssert {
  constructor (state) {
    this.REGEXP = /Available action (\w+)/
    this.state = state
  }

  verify (assertion) {
    const m = this.REGEXP.exec(assertion)
    if (m) {
      let found = false
      for (const action of this.state.action.items) {
        if (action.type == m[1]) found = true
      }
      return { result: found }
    }
  }
}

class TilePlacementOptionsAssert {
  constructor (state) {
    this.REGEXP = /Placement options\: (.*)/;
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
    for (const item of arr) {
      map.set(this.posKey(item.position), item)
    }
    return map
  }

  compareOptions(expected, actual) {
    const errors = []

    const expectedMap = this.indexByPosition(expected)
    const actualMap = this.indexByPosition(actual)

    // Missing or mismatched
    for (const [key, exp] of expectedMap) {
      if (!actualMap.has(key)) {
        errors.push({
          type: "missing",
          position: exp.position,
          expectedRotations: exp.rotations
        })
        continue
      }

      const act = actualMap.get(key)

      if (!this.arraysEqualUnordered(exp.rotations, act.rotations)) {
        errors.push({
          type: "rotation-mismatch",
          position: exp.position,
          expectedRotations: exp.rotations,
          actualRotations: act.rotations
        })
      }
    }

    // Extra
    for (const [key, act] of actualMap) {
      if (!expectedMap.has(key)) {
        errors.push({
          type: "extra",
          position: act.position,
          actualRotations: act.rotations
        })
      }
    }

    return errors
  }

  verify (assertion) {
    const m = this.REGEXP.exec(assertion)
    if (m) {
      const ENTRY = /\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]\s*-\s*\[\s*([-\d,\s]+?)\s*\]/g
      let result = []
      for (const match of m[1].matchAll(ENTRY)) {
        const x = Number(match[1])
        const y = Number(match[2])

        const rotations = match[3]
         .split(',')
         .map(v => Number(v.trim()))

        result.push({
          position: [x, y],
          rotations
        })
      }
      const errors = this.compareOptions(result, this.state.action.items[0].options)
      if (errors.length==0) {
        return { result: true }
      } else {
        console.log('Assert errors: ',errors)
        return { result: false }
      }
    }
  }
}

export function verifyScenario (state, { description, assertions }) {
  const result = {
    description,
    assertions: []
  }

  const rules = [
    new PointsAssert(state),
    new FeatureScoredAssert(state),
    new PassAssert(state),
    new PhaseAssert(state),
    new AvailableActionAssert(state),
    new TilePlacementOptionsAssert(state)
  ]

  for (const assertion of assertions) {
    let assertionResult = null
    for (const rule of rules) {
      const ruleResult = rule.verify(assertion)
      if (!isNil(ruleResult)) {
        assertionResult = {
          assertion,
          ...ruleResult
        }
        break
      }
    }
    if (assertionResult === null) {
      assertionResult = {
        assertion,
        error: 'Unknown assertion',
        result: false
      }
    }
    result.assertions.push(assertionResult)
  }

  return result
}
