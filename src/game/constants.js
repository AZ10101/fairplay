export const CPU_NAMES = [
  'YUI',
  'MAI',
  'RINA',
  'MIKA',
  'AYA',
  'MISAKI',
  'SAKURA',
  'NANA',
  'ERI',
  'YUKA',
]

/** Simple, high-contrast pair symbols */
export const SYMBOLS = ['◆', '●', '▲', '★', '■', '✚']

export const PAIR_COUNT = SYMBOLS.length
export const TURN_SECONDS = 5
/** Timer during final-pair escape mode (player turn, 2 cards left) */
export const FINAL_TURN_SECONDS = 5
/** CPU deliberately stops matching once this many cards remain (2 pairs) */
export const RESERVE_CARD_COUNT = 4
export const FLIP_REVEAL_MS = 780
export const CPU_THINK_MS = 550
export const ENDING_BAND_MS = 520
export const ENDING_LOSE_MS = 720
export const ESCAPE_DURATION_MS = 170

export const BGM_SRC = '/audio/bgm.mp3'
export const BGM_STORAGE_KEY = 'fairplay-bgm'

export function pickCpuName() {
  return CPU_NAMES[Math.floor(Math.random() * CPU_NAMES.length)]
}

export function playerTurnLimit(unmatchedCount) {
  return unmatchedCount === 2 ? FINAL_TURN_SECONDS : TURN_SECONDS
}

export function createDeck({ nearlyDone = false } = {}) {
  const deck = SYMBOLS.flatMap((symbol, i) => [
    { id: `${i}-a`, symbol, matched: false },
    { id: `${i}-b`, symbol, matched: false },
  ])

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck.map((card, index) => ({
    ...card,
    index,
    matched: nearlyDone ? card.symbol !== SYMBOLS[0] : false,
    offsetX: 0,
    offsetY: 0,
    offsetR: 0,
    fleeAnchorX: null,
    fleeAnchorY: null,
  }))
}
