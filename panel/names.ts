const FRIENDLY_NAMES = [
  'Avery', 'Bailey', 'Casey', 'Drew', 'Ellis', 'Frankie', 'Gray', 'Harper', 'Indy', 'Jules',
  'Kai', 'Lane', 'Morgan', 'Noel', 'Oakley', 'Parker', 'Quinn', 'Remy', 'Sage', 'Taylor', 'Wren',
  'Alex', 'Charlie', 'Devon', 'Emery', 'Finley', 'Kit', 'Lee', 'Robin', 'Rory', 'Rowan', 'Sam',
  'Shiloh', 'Sky', 'Teagan', 'Tobi', 'Val', 'Winter',
  'Arden', 'Blair', 'Cameron', 'Dakota', 'Eden', 'Hayden', 'Jamie', 'Kendall', 'Logan', 'Micah',
  'Reese', 'River'
]

const hash = (text: string): number => {
  let value = 2166136261
  for (let index = 0; index < text.length; index++)
    value = Math.imul(value ^ text.charCodeAt(index), 16777619)
  return value >>> 0
}

export function readAgentNames(value: unknown): Map<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return new Map()
  return new Map(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

/** Keeps active agents stable and releases departed names for the next arrivals. */
export function assignAgentNames(
  agentIds: readonly string[],
  previous: ReadonlyMap<string, string> = new Map()
): Map<string, string> {
  const names = new Map<string, string>()
  const used = new Set<string>()
  const active = new Set(agentIds)
  for (const [id, name] of [...previous].sort(([left], [right]) => left.localeCompare(right))) {
    if (active.has(id) && !used.has(name)) {
      names.set(id, name)
      used.add(name)
    }
  }
  for (const id of [...new Set(agentIds)].sort()) {
    if (names.has(id)) continue
    const start = hash(id) % FRIENDLY_NAMES.length
    let name = ''
    for (let offset = 0; offset < FRIENDLY_NAMES.length; offset++) {
      const candidate = FRIENDLY_NAMES[(start + offset) % FRIENDLY_NAMES.length]
      if (!used.has(candidate)) {
        name = candidate
        break
      }
    }
    if (!name) {
      const base = FRIENDLY_NAMES[start]
      let suffix = 2
      name = `${base} ${suffix}`
      while (used.has(name)) name = `${base} ${++suffix}`
    }
    used.add(name)
    names.set(id, name)
  }
  return names
}
