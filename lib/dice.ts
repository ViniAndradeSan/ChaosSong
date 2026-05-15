export type DicePart = {
  type: 'dice' | 'modifier'
  count?: number
  sides?: number
  modifier?: number
  results?: number[]
  keptResults?: number[] // Quais foram mantidos após kh/kl
  keepMode?: 'h' | 'l'
  keepCount?: number
  sign: '+' | '-'
}

export type DiceResult = {
  expression: string
  total: number
  parts: DicePart[]
}

const MAX_DICE = 50
const MAX_SIDES = 1000

export function parseDice(expression: string): DiceResult | null {
  const cleaned = expression.replace(/\s/g, '').toLowerCase()
  if (!cleaned) return null

  // Suporta: XdY, XdYkhN, XdYklN, +/-Z
  const tokenRegex = /([+-])?(\d*)d(\d+)(?:k([hl])(\d+))?|([+-])?(\d+)/gi
  const parts: DicePart[] = []
  let match
  let total = 0
  let isFirst = true

  while ((match = tokenRegex.exec(cleaned)) !== null) {
    if (match[3]) {
      // Dice roll: XdY or XdYkh/klN
      const sign = match[1] === '-' ? '-' : '+'
      const count = Math.min(parseInt(match[2] || '1', 10), MAX_DICE)
      const sides = Math.min(parseInt(match[3], 10), MAX_SIDES)
      const keepMode = match[4] as 'h' | 'l' | undefined
      const keepCount = match[5] ? Math.min(parseInt(match[5], 10), count) : undefined

      if (sides < 1 || count < 1) continue

      const results: number[] = []
      for (let i = 0; i < count; i++) {
        results.push(Math.floor(Math.random() * sides) + 1)
      }

      let keptResults: number[] | undefined
      let subtotal: number

      if (keepMode && keepCount) {
        const sorted = [...results].sort((a, b) => b - a)
        keptResults =
          keepMode === 'h' ? sorted.slice(0, keepCount) : sorted.slice(-keepCount)
        subtotal = keptResults.reduce((a, b) => a + b, 0)
      } else {
        subtotal = results.reduce((a, b) => a + b, 0)
      }

      total += sign === '-' ? -subtotal : subtotal

      parts.push({
        type: 'dice',
        count,
        sides,
        results,
        keptResults,
        keepMode,
        keepCount,
        sign: isFirst ? '+' : sign,
      })
    } else if (match[7]) {
      // Modifier: +Z or -Z
      const sign = match[6] === '-' ? '-' : '+'
      const modifier = parseInt(match[7], 10)

      total += sign === '-' ? -modifier : modifier

      parts.push({
        type: 'modifier',
        modifier,
        sign: isFirst ? '+' : sign,
      })
    }
    isFirst = false
  }

  if (parts.length === 0) return null

  return {
    expression: cleaned,
    total,
    parts,
  }
}

export function getDiceRollOutcome(result: DiceResult): 'normal' | 'critical' | 'failure' {
  const d20Part = result.parts.find((part) => part.type === 'dice' && part.sides === 20)
  if (!d20Part || !d20Part.results) return 'normal'

  const has20 = d20Part.results.some((value) => value === 20)
  const has1 = d20Part.results.some((value) => value === 1)
  if (has20 && !has1) return 'critical'
  if (has1 && !has20) return 'failure'
  return 'normal'
}

export function formatDiceResult(result: DiceResult): string {
  return result.parts
    .map((part, i) => {
      const prefix = i === 0 ? '' : ` ${part.sign} `
      if (part.type === 'dice') {
        if (part.keptResults && part.keepMode && part.keepCount) {
          const kh = part.keepMode === 'h' ? 'kh' : 'kl'
          return `${prefix}${part.count}d${part.sides}${kh}${part.keepCount} [${part.results?.join(', ')}] → kept [${part.keptResults.join(', ')}]`
        }
        return `${prefix}${part.count}d${part.sides} [${part.results?.join(', ')}]`
      }
      return `${prefix}${part.modifier}`
    })
    .join('')
}
