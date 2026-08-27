import { useCallback, useEffect, useRef } from 'react'

export function useBgm(src, volume = 0.42) {
  const audioRef = useRef(null)
  const enabledRef = useRef(false)

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
    }
  }, [src, volume])

  const setEnabled = useCallback((on) => {
    enabledRef.current = on
    if (!on) audioRef.current?.pause()
  }, [])

  const play = useCallback(async () => {
    if (!enabledRef.current || !audioRef.current) return
    try {
      if (audioRef.current.paused) {
        await audioRef.current.play()
      }
    } catch {
      // Autoplay blocked until user gesture — startGame tap satisfies this
    }
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  return { setEnabled, play, pause }
}
