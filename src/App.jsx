import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BGM_SRC,
  BGM_STORAGE_KEY,
  CPU_THINK_MS,
  createDeck,
  ENDING_BAND_MS,
  ENDING_LOSE_MS,
  ESCAPE_DURATION_MS,
  FINAL_TURN_SECONDS,
  FLIP_REVEAL_MS,
  pickCpuName,
  playerTurnLimit,
  RESERVE_CARD_COUNT,
  TURN_SECONDS,
} from './game/constants'
import { useBgm } from './hooks/useBgm'
import './App.css'

function App() {
  const [phase, setPhase] = useState('title')
  const [cpuName, setCpuName] = useState(() => pickCpuName())
  const [cards, setCards] = useState(() => createDeck())
  const [flippedIds, setFlippedIds] = useState([])
  const [lockInput, setLockInput] = useState(false)
  const [isPlayerTurn, setIsPlayerTurn] = useState(false)
  const [scores, setScores] = useState({ you: 0, cpu: 0 })
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS)
  const [turnLimit, setTurnLimit] = useState(TURN_SECONDS)
  const [isEscaping, setIsEscaping] = useState(false)
  const [turnKey, setTurnKey] = useState(0)
  const [cpuPulse, setCpuPulse] = useState(0)
  const [endingStep, setEndingStep] = useState(0) // 0 band, 1 lose, 2 fair+buttons
  const [isPaused, setIsPaused] = useState(false)
  const [musicOn, setMusicOn] = useState(
    () => localStorage.getItem(BGM_STORAGE_KEY) !== 'off',
  )
  const [cpuTurnFxKey, setCpuTurnFxKey] = useState(0)

  const bgm = useBgm(BGM_SRC, 0.42, musicOn)
  const shellRef = useRef(null)
  const boardRef = useRef(null)
  const cardElsRef = useRef(new Map())
  const memoryRef = useRef(new Map())
  const timerRef = useRef(null)
  const turnGenRef = useRef(0)
  const busyRef = useRef(false)
  const lastTapAtRef = useRef(0)
  const phaseRef = useRef(phase)
  const cardsRef = useRef(cards)
  const isPlayerTurnRef = useRef(isPlayerTurn)
  const isFinalPairRef = useRef(false)
  const flippedIdsRef = useRef(flippedIds)
  const isPausedRef = useRef(isPaused)

  const unmatchedCount = cards.filter((c) => !c.matched).length
  const isFinalPair = unmatchedCount === 2

  phaseRef.current = phase
  cardsRef.current = cards
  isPlayerTurnRef.current = isPlayerTurn
  isFinalPairRef.current = isFinalPair
  flippedIdsRef.current = flippedIds
  isPausedRef.current = isPaused

  useEffect(() => {
    bgm.setEnabled(musicOn)
  }, [musicOn, bgm])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const rememberCard = useCallback((card) => {
    if (!card || card.matched) return
    const map = memoryRef.current
    if (!map.has(card.symbol)) map.set(card.symbol, new Set())
    map.get(card.symbol).add(card.id)
  }, [])

  const resetEscapeOffsets = useCallback(() => {
    setCards((prev) =>
      prev.map((c) =>
        c.offsetX ||
        c.offsetY ||
        c.offsetR ||
        c.fleeAnchorX != null ||
        c.fleeAnchorY != null
          ? {
              ...c,
              offsetX: 0,
              offsetY: 0,
              offsetR: 0,
              fleeAnchorX: null,
              fleeAnchorY: null,
            }
          : c,
      ),
    )
    setIsEscaping(false)
  }, [])

  const applyPlayerTurnTimer = useCallback((unmatched) => {
    const limit = playerTurnLimit(unmatched)
    setTurnLimit(limit)
    setTimeLeft(limit)
    setTurnKey((k) => k + 1)
  }, [])

  const triggerCpuTurnFx = useCallback(() => {
    setCpuTurnFxKey((k) => k + 1)
  }, [])

  const beginPlayerTurn = useCallback(() => {
    turnGenRef.current += 1
    busyRef.current = false
    setFlippedIds([])
    setLockInput(false)
    setIsPlayerTurn(true)
    setIsEscaping(false)
    const left = cardsRef.current.filter((c) => !c.matched).length
    applyPlayerTurnTimer(left)
  }, [applyPlayerTurnTimer])

  const beginCpuTurn = useCallback(() => {
    clearTimer()
    turnGenRef.current += 1
    busyRef.current = false
    setFlippedIds([])
    setLockInput(true)
    setIsEscaping(false)
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        offsetX: 0,
        offsetY: 0,
        offsetR: 0,
        fleeAnchorX: null,
        fleeAnchorY: null,
      })),
    )
    setIsPlayerTurn(false)
    triggerCpuTurnFx()
    setCpuPulse((n) => n + 1)
  }, [clearTimer, triggerCpuTurnFx])

  const startGame = useCallback(() => {
    bgm.unlock()
    bgm.play()
    clearTimer()
    turnGenRef.current += 1
    busyRef.current = false
    memoryRef.current = new Map()
    const nearlyDone =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).has('final')
    setCpuName(pickCpuName())
    setCards(createDeck({ nearlyDone }))
    setFlippedIds([])
    setLockInput(true)
    setEndingStep(0)
    setScores({
      you: nearlyDone ? 3 : 0,
      cpu: nearlyDone ? 2 : 0,
    })
    setIsEscaping(false)
    setIsPaused(false)
    setTurnKey((k) => k + 1)
    setPhase('playing')

    // Girl always goes first — except ?final debug where player needs the last pair
    if (nearlyDone) {
      setIsPlayerTurn(true)
      setLockInput(false)
      setTurnLimit(FINAL_TURN_SECONDS)
      setTimeLeft(FINAL_TURN_SECONDS)
      setCpuPulse(0)
    } else {
      setIsPlayerTurn(false)
      setTurnLimit(TURN_SECONDS)
      setTimeLeft(TURN_SECONDS)
      triggerCpuTurnFx()
      setCpuPulse((n) => n + 1)
    }
  }, [clearTimer, bgm, triggerCpuTurnFx])

  const setMusicPreference = useCallback(
    (on) => {
      setMusicOn(on)
      localStorage.setItem(BGM_STORAGE_KEY, on ? 'on' : 'off')
      if (on) {
        bgm.unlock()
        bgm.play()
      } else {
        bgm.pause()
      }
    },
    [bgm],
  )

  const returnToTitle = useCallback(() => {
    clearTimer()
    turnGenRef.current += 1
    busyRef.current = false
    bgm.pause()
    setPhase('title')
    setIsPaused(false)
    setIsEscaping(false)
    setLockInput(false)
    setFlippedIds([])
    setEndingStep(0)
    setCpuTurnFxKey(0)
    setCpuPulse(0)
  }, [clearTimer, bgm])

  const finishWithFairPlay = useCallback(() => {
    clearTimer()
    turnGenRef.current += 1
    busyRef.current = true
    setLockInput(true)
    setIsEscaping(false)
    setEndingStep(0)
    setPhase('ending')

    window.setTimeout(() => setEndingStep(1), ENDING_BAND_MS)
    window.setTimeout(
      () => {
        setEndingStep(2)
        busyRef.current = false
      },
      ENDING_BAND_MS + ENDING_LOSE_MS,
    )
  }, [clearTimer])

  const awardPair = useCallback(
    (ids, toPlayer) => {
      const remainingBefore = cardsRef.current.filter((c) => !c.matched)
      if (toPlayer && remainingBefore.length === 2) {
        return 'blocked'
      }

      setCards((prev) =>
        prev.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                matched: true,
                offsetX: 0,
                offsetY: 0,
                offsetR: 0,
                fleeAnchorX: null,
                fleeAnchorY: null,
              }
            : c,
        ),
      )
      setFlippedIds([])
      setScores((s) =>
        toPlayer ? { ...s, you: s.you + 1 } : { ...s, cpu: s.cpu + 1 },
      )

      ids.forEach((id) => {
        for (const set of memoryRef.current.values()) set.delete(id)
      })

      const left = cardsRef.current.filter(
        (c) => !c.matched && !ids.includes(c.id),
      ).length

      if (left === 0) {
        finishWithFairPlay()
        return 'done'
      }
      return 'continue'
    },
    [finishWithFairPlay],
  )

  const togglePause = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    setIsPaused((p) => {
      const next = !p
      if (next) {
        clearTimer()
        turnGenRef.current += 1
        bgm.pause()
      } else {
        bgm.unlock()
        bgm.play()
        if (isPlayerTurnRef.current) {
          setTurnKey((k) => k + 1)
        } else {
          setCpuPulse((n) => n + 1)
        }
      }
      return next
    })
  }, [clearTimer, bgm])

  /** Player countdown — continues while the 2nd final card is fleeing */
  useEffect(() => {
    clearTimer()
    if (phase !== 'playing' || !isPlayerTurn || isPaused) return undefined

    const gen = turnGenRef.current
    timerRef.current = window.setInterval(() => {
      if (phaseRef.current !== 'playing' || !isPlayerTurnRef.current) return
      if (isPausedRef.current) return
      if (turnGenRef.current !== gen) return

      setTimeLeft((t) => {
        if (t <= 1) {
          clearTimer()
          busyRef.current = false
          beginCpuTurn()
          return 0
        }
        return t - 1
      })
    }, 1000)

    return clearTimer
  }, [phase, isPlayerTurn, isPaused, turnKey, clearTimer, beginCpuTurn])

  const computeFleeTarget = useCallback((cardId) => {
    const el = cardElsRef.current.get(cardId)
    const card = cardsRef.current.find((c) => c.id === cardId)
    const prevX = card?.offsetX ?? 0
    const prevY = card?.offsetY ?? 0
    const prevR = card?.offsetR ?? 0

    // Freeze grid origin on first flee — avoids bad coords mid-CSS-transition
    let anchorLeft = card?.fleeAnchorX ?? null
    let anchorTop = card?.fleeAnchorY ?? null

    if (anchorLeft == null && el) {
      const rect = el.getBoundingClientRect()
      anchorLeft = rect.left - prevX
      anchorTop = rect.top - prevY
    }

    if (anchorLeft == null || anchorTop == null) {
      const angle = Math.random() * Math.PI * 2
      const dist = 48 + Math.random() * 32
      return {
        x: prevX + Math.cos(angle) * dist,
        y: prevY + Math.sin(angle) * dist,
        r: (Math.random() - 0.5) * 24,
        fleeAnchorX: anchorLeft,
        fleeAnchorY: anchorTop,
      }
    }

    const w = el?.offsetWidth ?? 68
    const h = el?.offsetHeight ?? 90
    const { minX, minY, maxX, maxY } = getFleeBounds(
      shellRef.current,
      w,
      h,
    )

    const curLeft = anchorLeft + prevX
    const curTop = anchorTop + prevY

    const boundMinLeft = minX
    const boundMinTop = minY
    const boundMaxLeft = maxX
    const boundMaxTop = maxY

    if (boundMaxLeft <= boundMinLeft || boundMaxTop <= boundMinTop) {
      return { x: prevX, y: prevY, r: prevR, fleeAnchorX: anchorLeft, fleeAnchorY: anchorTop }
    }

    const midX = (boundMinLeft + boundMaxLeft + w) * 0.5
    const midY = (boundMinTop + boundMaxTop + h) * 0.5
    const preferLeft = curLeft + w * 0.5 > midX
    const preferTop = curTop + h * 0.5 > midY
    const roll = Math.random()

    let targetLeft
    let targetTop
    const spanX = boundMaxLeft - boundMinLeft
    const spanY = boundMaxTop - boundMinTop

    if (roll < 0.34) {
      targetLeft = preferLeft
        ? boundMinLeft + Math.random() * Math.min(40, spanX)
        : boundMaxLeft - Math.random() * Math.min(40, spanX)
      targetTop = clamp(
        curTop + (Math.random() - 0.5) * spanY * 0.65,
        boundMinTop,
        boundMaxTop,
      )
    } else if (roll < 0.67) {
      targetTop = preferTop
        ? boundMinTop + Math.random() * Math.min(40, spanY)
        : boundMaxTop - Math.random() * Math.min(40, spanY)
      targetLeft = clamp(
        curLeft + (Math.random() - 0.5) * spanX * 0.65,
        boundMinLeft,
        boundMaxLeft,
      )
    } else {
      targetLeft = preferLeft
        ? boundMinLeft + Math.random() * spanX * 0.3
        : boundMaxLeft - Math.random() * spanX * 0.3
      targetTop = preferTop
        ? boundMinTop + Math.random() * spanY * 0.3
        : boundMaxTop - Math.random() * spanY * 0.3
      targetLeft = clamp(targetLeft, boundMinLeft, boundMaxLeft)
      targetTop = clamp(targetTop, boundMinTop, boundMaxTop)
    }

    if (Math.hypot(targetLeft - curLeft, targetTop - curTop) < 48) {
      targetLeft = preferLeft ? boundMinLeft : boundMaxLeft
      targetTop = preferTop ? boundMinTop : boundMaxTop
    }

    let x = targetLeft - anchorLeft
    let y = targetTop - anchorTop

    const finalLeft = clamp(anchorLeft + x, boundMinLeft, boundMaxLeft)
    const finalTop = clamp(anchorTop + y, boundMinTop, boundMaxTop)
    x = finalLeft - anchorLeft
    y = finalTop - anchorTop

    const r = (Math.random() - 0.5) * 28
    return { x, y, r, fleeAnchorX: anchorLeft, fleeAnchorY: anchorTop }
  }, [])

  /**
   * Final-pair 2nd-card escape — only after the first card is already flipped.
   * First card flips normally; this path never flips the second.
   */
  const fleeCard = useCallback(
    (cardId) => {
      if (phaseRef.current !== 'playing') return
      if (!isPlayerTurnRef.current || !isFinalPairRef.current) return

      const { x, y, r, fleeAnchorX, fleeAnchorY } = computeFleeTarget(cardId)
      setIsEscaping(true)
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? {
                ...c,
                offsetX: x,
                offsetY: y,
                offsetR: r,
                fleeAnchorX: c.fleeAnchorX ?? fleeAnchorX ?? null,
                fleeAnchorY: c.fleeAnchorY ?? fleeAnchorY ?? null,
              }
            : c,
        ),
      )
    },
    [computeFleeTarget],
  )

  const handleCardTap = useCallback(
    (cardId) => {
      if (phaseRef.current !== 'playing') return
      if (isPausedRef.current) return
      if (!isPlayerTurnRef.current) return
      if (busyRef.current) return

      const card = cardsRef.current.find((c) => c.id === cardId)
      if (!card || card.matched) return

      // ── Final pair: 1st flips normally, 2nd flees forever ──
      if (isFinalPairRef.current) {
        if (flippedIdsRef.current.includes(cardId)) return

        if (flippedIdsRef.current.length >= 1) {
          fleeCard(cardId)
          return
        }
        // first tap of final pair → fall through to normal flip
      }

      if (lockInput) return
      if (flippedIdsRef.current.includes(cardId)) return
      if (flippedIdsRef.current.length >= 2) return

      rememberCard(card)
      const next = [...flippedIdsRef.current, cardId]
      setFlippedIds(next)

      if (next.length < 2) return

      // Should not reach here on final pair (2nd tap flees)
      if (isFinalPairRef.current) {
        setFlippedIds([next[0]])
        fleeCard(next[1])
        return
      }

      busyRef.current = true
      setLockInput(true)

      const [aId, bId] = next
      const a = cardsRef.current.find((c) => c.id === aId)
      const b = cardsRef.current.find((c) => c.id === bId)

      if (a && b && a.symbol === b.symbol) {
        window.setTimeout(() => {
          const result = awardPair([aId, bId], true)
          busyRef.current = false
          if (result === 'done') return
          setLockInput(false)
          turnGenRef.current += 1
          const left = cardsRef.current.filter((c) => !c.matched).length
          applyPlayerTurnTimer(left)
        }, FLIP_REVEAL_MS * 0.5)
      } else {
        window.setTimeout(() => {
          setFlippedIds([])
          busyRef.current = false
          beginCpuTurn()
        }, FLIP_REVEAL_MS)
      }
    },
    [applyPlayerTurnTimer, awardPair, beginCpuTurn, fleeCard, lockInput, rememberCard],
  )

  const activateCard = useCallback(
    (cardId) => {
      const now = performance.now()
      if (now - lastTapAtRef.current < 40) return
      lastTapAtRef.current = now
      handleCardTap(cardId)
    },
    [handleCardTap],
  )

  const pickCpuMove = useCallback(() => {
    const available = cardsRef.current.filter((c) => !c.matched)
    if (available.length === 0) return []
    // Final pair only — CPU takes it after player fails
    if (available.length === 2) return [available[0].id, available[1].id]

    // Last 2 pairs on board — CPU always misses on purpose
    if (available.length === RESERVE_CARD_COUNT) {
      const first = available[Math.floor(Math.random() * available.length)]
      const others = available.filter((c) => c.symbol !== first.symbol)
      const second = others[Math.floor(Math.random() * others.length)]
      return [first.id, second.id]
    }

    const knownPairs = []
    for (const [symbol, ids] of memoryRef.current.entries()) {
      const live = [...ids].filter((id) =>
        available.some((c) => c.id === id && c.symbol === symbol),
      )
      if (live.length >= 2) knownPairs.push([live[0], live[1]])
    }

    if (knownPairs.length > 0 && Math.random() < 0.4) {
      return knownPairs[Math.floor(Math.random() * knownPairs.length)]
    }

    const first = available[Math.floor(Math.random() * available.length)]
    rememberCard(first)

    const mates = memoryRef.current.get(first.symbol)
    if (mates && Math.random() < 0.32) {
      const mateId = [...mates].find(
        (id) => id !== first.id && available.some((c) => c.id === id),
      )
      if (mateId) return [first.id, mateId]
    }

    let second = first
    if (available.length > 1) {
      do {
        second = available[Math.floor(Math.random() * available.length)]
      } while (second.id === first.id)
    }

    rememberCard(second)
    return [first.id, second.id]
  }, [rememberCard])

  useEffect(() => {
    if (phase !== 'playing' || isPlayerTurn || isPaused) return undefined

    let cancelled = false
    const gen = turnGenRef.current

    const run = async () => {
      if (!(await waitUnlessPaused(
        CPU_THINK_MS,
        () => cancelled || turnGenRef.current !== gen,
        () => isPausedRef.current,
      ))) {
        return
      }
      if (phaseRef.current !== 'playing' || isPlayerTurnRef.current) return

      resetEscapeOffsets()

      const [firstId, secondId] = pickCpuMove()
      if (!firstId || !secondId) return

      const first = cardsRef.current.find((c) => c.id === firstId)
      const second = cardsRef.current.find((c) => c.id === secondId)
      if (!first || !second || first.matched || second.matched) return

      rememberCard(first)
      setFlippedIds([firstId])
      if (!(await waitUnlessPaused(
        CPU_THINK_MS,
        () => cancelled || turnGenRef.current !== gen,
        () => isPausedRef.current,
      ))) {
        return
      }
      if (isPlayerTurnRef.current) return

      rememberCard(second)
      setFlippedIds([firstId, secondId])
      if (!(await waitUnlessPaused(
        FLIP_REVEAL_MS,
        () => cancelled || turnGenRef.current !== gen,
        () => isPausedRef.current,
      ))) {
        return
      }
      if (isPlayerTurnRef.current) return

      if (first.symbol === second.symbol) {
        const result = awardPair([firstId, secondId], false)
        if (result === 'done' || cancelled) return
        if (!(await waitUnlessPaused(
          CPU_THINK_MS * 0.55,
          () => cancelled || turnGenRef.current !== gen,
          () => isPausedRef.current,
        ))) {
          return
        }
        turnGenRef.current += 1
        setFlippedIds([])
        setCpuPulse((n) => n + 1)
      } else {
        setFlippedIds([])
        beginPlayerTurn()
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    phase,
    isPlayerTurn,
    isPaused,
    cpuPulse,
    awardPair,
    beginPlayerTurn,
    pickCpuMove,
    rememberCard,
    resetEscapeOffsets,
  ])

  const timerPct = Math.max(0, (timeLeft / turnLimit) * 100)
  const timerUrgent = timeLeft <= 3
  const turnLabel = isPlayerTurn ? 'YOUR TURN' : `${cpuName}'s TURN`
  const showEnding = phase === 'ending'

  if (phase === 'title') {
    return (
      <div className="shell shell--title">
        <h1 className="title-brand">FAIR PLAY</h1>
        <div className="music-pick">
          <span className="music-pick-label">BGM</span>
          <div className="music-pick-options" role="group" aria-label="BGM">
            <button
              type="button"
              className={`music-pick-btn ${musicOn ? 'is-on' : ''}`}
              onClick={() => setMusicPreference(true)}
              onPointerDown={() => bgm.unlock()}
              aria-pressed={musicOn}
            >
              ON
            </button>
            <button
              type="button"
              className={`music-pick-btn ${!musicOn ? 'is-on' : ''}`}
              onClick={() => setMusicPreference(false)}
              aria-pressed={!musicOn}
            >
              OFF
            </button>
          </div>
        </div>
        <button
          type="button"
          className="title-start"
          onPointerDown={() => bgm.unlock()}
          onClick={startGame}
        >
          START
        </button>
      </div>
    )
  }

  return (
    <div
      className={`shell shell--game ${isEscaping ? 'shell--escaping' : ''}`}
      ref={shellRef}
    >
      <div className="game-top">
        <p
          key={isPlayerTurn ? 'you-turn' : `cpu-turn-${cpuTurnFxKey}`}
          className={`turn-banner ${isPlayerTurn ? 'turn-banner--you' : 'turn-banner--cpu'}`}
        >
          {turnLabel}
          {!isPlayerTurn && (
            <span key={cpuTurnFxKey} className="cpu-hearts" aria-hidden>
              <span className="cpu-heart cpu-heart--1">♡</span>
              <span className="cpu-heart cpu-heart--2">♡</span>
              <span className="cpu-heart cpu-heart--3">♡</span>
            </span>
          )}
        </p>
        <button
          type="button"
          className="pause-btn"
          onClick={togglePause}
          aria-label={isPaused ? '再開' : '一時停止'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      </div>

      <header className="hud">
        <div className="versus">
          <div className={`side side--cpu ${!isPlayerTurn ? 'side--active' : ''}`}>
            {!isPlayerTurn && (
              <span key={`side-${cpuTurnFxKey}`} className="cpu-hearts cpu-hearts--side" aria-hidden>
                <span className="cpu-heart cpu-heart--1">♡</span>
                <span className="cpu-heart cpu-heart--2">♡</span>
              </span>
            )}
            <span className="side-label">{cpuName}</span>
            <span className="side-score">{scores.cpu}</span>
          </div>
          <span className="versus-vs">vs</span>
          <div className={`side ${isPlayerTurn ? 'side--active' : ''}`}>
            <span className="side-label">YOU</span>
            <span className="side-score">{scores.you}</span>
          </div>
        </div>

        <div
          className={`timer ${isPlayerTurn ? '' : 'timer--idle'} ${
            timerUrgent && isPlayerTurn ? 'timer--urgent' : ''
          }`}
          aria-label={`残り ${timeLeft} 秒`}
        >
          <div className="timer-track">
            <div
              className="timer-fill"
              style={{ width: isPlayerTurn ? `${timerPct}%` : '0%' }}
            />
          </div>
          <span className="timer-num">{isPlayerTurn ? timeLeft : '—'}</span>
        </div>
      </header>

      <div
        className={`board ${isEscaping ? 'board--escaping' : ''}`}
        ref={boardRef}
      >
        {cards.map((card) => {
          const shown = card.matched || flippedIds.includes(card.id)
          const fleeing =
            isEscaping &&
            (card.offsetX !== 0 || card.offsetY !== 0 || card.offsetR)

          return (
            <div
              key={card.id}
              className={[
                'card-slot',
                card.matched ? 'card-slot--matched' : '',
                fleeing ? 'card-slot--fleeing' : '',
                isFinalPair &&
                isPlayerTurn &&
                !card.matched &&
                flippedIds.length >= 1 &&
                !flippedIds.includes(card.id)
                  ? 'card-slot--final'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                transform: `translate(${card.offsetX}px, ${card.offsetY}px) rotate(${card.offsetR || 0}deg)`,
                transitionDuration: `${ESCAPE_DURATION_MS}ms`,
                zIndex: fleeing ? 30 : undefined,
              }}
              ref={(node) => {
                if (node) cardElsRef.current.set(card.id, node)
                else cardElsRef.current.delete(card.id)
              }}
            >
              <button
                type="button"
                className="card"
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return
                  e.preventDefault()
                  activateCard(card.id)
                }}
                onClick={(e) => {
                  e.preventDefault()
                  activateCard(card.id)
                }}
                aria-label={shown ? `card ${card.symbol}` : 'facedown card'}
              >
                <span
                  className={`card-flip ${shown ? 'is-flipped' : ''}`}
                  aria-hidden
                >
                  <span className="card-face card-face--back" />
                  <span className="card-face card-face--front">
                    <span className="card-symbol" data-symbol={card.symbol}>
                      {card.symbol}
                    </span>
                  </span>
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {isPaused && phase === 'playing' && (
        <div className="pause-overlay">
          <p className="pause-label">PAUSED</p>
          <div className="overlay-actions">
            <button type="button" className="pause-resume" onClick={togglePause}>
              再開
            </button>
            <button type="button" className="top-btn" onClick={returnToTitle}>
              Return to top
            </button>
          </div>
        </div>
      )}

      {showEnding && (
        <div
          className={`ending-overlay ending-overlay--step-${endingStep}`}
          aria-live="polite"
        >
          <div className="ending-band" />
          <div className="ending-copy">
            {endingStep >= 1 && <p className="ending-lose">YOU LOSE</p>}
            {endingStep >= 2 && (
              <p className="ending-fair">
                FAIR PLAY<span aria-hidden>♡</span>
              </p>
            )}
            {endingStep >= 2 && (
              <div className="overlay-actions overlay-actions--ending">
                <button type="button" className="again-btn" onClick={startGame}>
                  PLAY AGAIN?
                </button>
                <button type="button" className="top-btn top-btn--ending" onClick={returnToTitle}>
                  Return to top
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/** Keep the whole card inside the visible play area (viewport ∩ game shell) */
function getFleeBounds(containerEl, cardW, cardH) {
  const vv = window.visualViewport
  const vLeft = vv?.offsetLeft ?? 0
  const vTop = vv?.offsetTop ?? 0
  const vWidth = vv?.width ?? window.innerWidth
  const vHeight = vv?.height ?? window.innerHeight

  const pad = 8
  const rotPad = 10

  let minX = vLeft + pad
  let minY = vTop + pad
  let maxX = vLeft + vWidth - pad - cardW - rotPad
  let maxY = vTop + vHeight - pad - cardH - rotPad

  if (containerEl) {
    const box = containerEl.getBoundingClientRect()
    minX = Math.max(minX, box.left + pad)
    minY = Math.max(minY, box.top + pad)
    maxX = Math.min(maxX, box.right - pad - cardW - rotPad)
    maxY = Math.min(maxY, box.bottom - pad - cardH - rotPad)
  }

  return { minX, minY, maxX, maxY }
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** Resolves false if cancelled or paused before the delay finishes */
function waitUnlessPaused(ms, isCancelled, isPausedCheck) {
  return new Promise((resolve) => {
    const started = performance.now()
    const tick = () => {
      if (isCancelled()) {
        resolve(false)
        return
      }
      if (isPausedCheck()) {
        resolve(false)
        return
      }
      if (performance.now() - started >= ms) {
        resolve(true)
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
}

export default App
