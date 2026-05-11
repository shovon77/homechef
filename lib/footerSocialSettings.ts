import ENV from './env'

export type FooterSocialUrlKey = 'instagram' | 'linkedin' | 'facebook' | 'whatsapp' | 'youtube'

/** `app_settings.key` values for footer social links (public read, admin write). */
export const FOOTER_SOCIAL_SETTING_KEYS: Record<FooterSocialUrlKey, string> = {
  instagram: 'social_instagram_url',
  linkedin: 'social_linkedin_url',
  facebook: 'social_facebook_url',
  whatsapp: 'social_whatsapp_url',
  youtube: 'social_youtube_url',
}

export function emptyFooterSocialUrls(): Record<FooterSocialUrlKey, string> {
  return {
    instagram: '',
    linkedin: '',
    facebook: '',
    whatsapp: '',
    youtube: '',
  }
}

export function socialUrlsFromEnv(): Record<FooterSocialUrlKey, string> {
  return {
    instagram: ENV.SOCIAL_INSTAGRAM_URL.trim(),
    linkedin: ENV.SOCIAL_LINKEDIN_URL.trim(),
    facebook: ENV.SOCIAL_FACEBOOK_URL.trim(),
    whatsapp: ENV.SOCIAL_WHATSAPP_URL.trim(),
    youtube: ENV.SOCIAL_YOUTUBE_URL.trim(),
  }
}

const DB_KEY_TO_LOGICAL: Record<string, FooterSocialUrlKey> = Object.fromEntries(
  (Object.entries(FOOTER_SOCIAL_SETTING_KEYS) as [FooterSocialUrlKey, string][]).map(([logical, dbKey]) => [dbKey, logical]),
)

/** Non-empty `app_settings` values override env; missing or empty DB rows use build-time env. */
export function mergeSocialUrlsWithDb(rows: { key: string; value: string }[] | null | undefined): Record<FooterSocialUrlKey, string> {
  const env = socialUrlsFromEnv()
  const out: Record<FooterSocialUrlKey, string> = { ...env }
  for (const r of rows ?? []) {
    const logical = DB_KEY_TO_LOGICAL[r.key]
    if (!logical) continue
    const trimmed = (r.value ?? '').trim()
    if (trimmed.length > 0) out[logical] = trimmed
  }
  return out
}
