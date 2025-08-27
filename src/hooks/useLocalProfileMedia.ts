import { useEffect, useState, useCallback } from 'react'

export type ProfileMedia = {
  avatarUrl?: string
  bannerUrl?: string
}

const storageKey = (address?: string) => (address ? `profile-media:${address.toLowerCase()}` : '')

export function useLocalProfileMedia(address?: string) {
  const [media, setMedia] = useState<ProfileMedia>({})

  // Load from localStorage
  useEffect(() => {
    if (!address) return
    try {
      const raw = localStorage.getItem(storageKey(address))
      if (raw) setMedia(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [address])

  const save = useCallback((next: ProfileMedia) => {
    setMedia(next)
    try {
      if (address) localStorage.setItem(storageKey(address), JSON.stringify(next))
    } catch {
      // ignore quota errors
    }
  }, [address])

  const setAvatar = useCallback((dataUrl?: string) => {
    save({ ...media, avatarUrl: dataUrl })
  }, [media, save])

  const setBanner = useCallback((dataUrl?: string) => {
    save({ ...media, bannerUrl: dataUrl })
  }, [media, save])

  return {
    avatarUrl: media.avatarUrl,
    bannerUrl: media.bannerUrl,
    setAvatar,
    setBanner,
  }
}
