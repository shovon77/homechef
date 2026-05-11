import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  FOOTER_SOCIAL_SETTING_KEYS,
  mergeSocialUrlsWithDb,
  type FooterSocialUrlKey,
} from '../lib/footerSocialSettings'

export type FooterSocialUrls = Record<FooterSocialUrlKey, string>

export function useFooterSocialUrls() {
  const [urls, setUrls] = useState<FooterSocialUrls>(() => mergeSocialUrlsWithDb([]))

  useEffect(() => {
    let cancelled = false
    const keys = Object.values(FOOTER_SOCIAL_SETTING_KEYS)
    ;(async () => {
      const { data, error } = await supabase.from('app_settings').select('key, value').in('key', keys)
      if (cancelled || error) {
        if (error && __DEV__) console.warn('useFooterSocialUrls:', error.message)
        return
      }
      setUrls(mergeSocialUrlsWithDb(data ?? []))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return urls
}
