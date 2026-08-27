import { useCallback, useEffect, useRef } from 'react'

export function useBgm(src, volume = 0.42, enabled = true) {
  const audioRef = useRef(null)
  const unlockedRef = useRef(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = volume
    audio.preload = 'auto'
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
      unlockedRef.current = false
    }
  }, [src, volume])

  useEffect(() => {
    if (!enabled) audioRef.current?.pause()
  }, [enabled])

  /** iOS/Safari: unlock audio output within a user gesture */
  const unlock = useCallback(() => {
    const audio = audioRef.current
    if (!audio || unlockedRef.current) return

    audio.muted = true
    const attempt = audio.play()
    if (!attempt) return

    attempt
      .then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.muted = false
        unlockedRef.current = true
      })
      .catch(() => {
        audio.muted = false
      })
  }, [])

  const play = useCallback(() => {
    if (!enabledRef.current || !audioRef.current) return
    const audio = audioRef.current
    if (!audio.paused) return

    const attempt = audio.play()
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {})
    }
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  return { unlock, play, pause }
}
