import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://mwqtenuykrdlspxhgdlw.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_NvYSYfPuqL04mnkD8BSnXw_uEOMtGam'

const PRIMARY_PRODUCTION_ORIGIN = 'https://washmykicks-web.vercel.app'

const rateBuckets = new Map<string, number[]>()

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function getClientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  const first = Array.isArray(fwd) ? fwd[0] : typeof fwd === 'string' ? fwd.split(',')[0] : ''
  return (first || req.socket?.remoteAddress || 'unknown').trim()
}

export function isAllowedOrigin(origin: string | undefined, hostHeader?: string | string[]): boolean {
  if (!origin) return true
  const normalized = origin.trim().toLowerCase()
  if (normalized === PRIMARY_PRODUCTION_ORIGIN) return true
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) return true
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  if (host) {
    const cleanHost = host.trim().toLowerCase()
    if (normalized === `https://${cleanHost}` || normalized === `http://${cleanHost}`) return true
  }
  return false
}

/**
 * Sets baseline browser security headers + strict same-origin CORS (never '*').
 * Returns true if the request was an OPTIONS preflight that has already been answered.
 */
export function applyApiHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin
  const allowedOrigin =
    originHeader && isAllowedOrigin(originHeader, req.headers.host)
      ? originHeader
      : PRIMARY_PRODUCTION_ORIGIN

  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    if (originHeader && !isAllowedOrigin(originHeader, req.headers.host)) {
      res.status(403).json({ ok: false, error: 'Cross-origin request denied.' })
      return true
    }
    res.status(204).end()
    return true
  }
  return false
}

export function enforceTrustedOrigin(req: VercelRequest, res: VercelResponse): boolean {
  const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin
  if (originHeader && !isAllowedOrigin(originHeader, req.headers.host)) {
    res.status(403).json({ ok: false, error: 'Untrusted request origin.' })
    return false
  }
  return true
}

export function checkMemoryRateLimit(
  bucketKey: string,
  maxHits: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  if (rateBuckets.size > 2000) {
    for (const [k, hits] of rateBuckets.entries()) {
      const active = hits.filter((ts) => now - ts < windowMs)
      if (active.length === 0) rateBuckets.delete(k)
      else rateBuckets.set(k, active)
    }
  }

  const prev = (rateBuckets.get(bucketKey) || []).filter((ts) => now - ts < windowMs)
  if (prev.length >= maxHits) {
    const oldest = prev[0] || now
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000))
    rateBuckets.set(bucketKey, prev)
    return { allowed: false, retryAfterSec }
  }
  prev.push(now)
  rateBuckets.set(bucketKey, prev)
  return { allowed: true, retryAfterSec: 0 }
}

export function getOtpSecretOrNull(): string | null {
  const secret =
    process.env.OTP_SIGNING_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GMAIL_APP_PASSWORD ||
    ''
  return secret.trim() ? secret.trim() : null
}

export function getSupabaseServerClient() {
  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY

  const adminClient = url && (serviceKey || anonKey) ? createClient(url, serviceKey || anonKey) : null
  const authClient = url && anonKey ? createClient(url, anonKey) : adminClient
  return {
    adminClient,
    authClient,
    hasServiceRole: Boolean(serviceKey),
  }
}

export type VerifiedBearerSession = {
  authUid: string
  email: string
  role: 'CUSTOMER' | 'STAFF' | 'ADMINISTRATOR'
  userId?: number
  customerId?: number
  branchName?: string
  fullName?: string
}

export async function verifyBearerSession(req: VercelRequest): Promise<VerifiedBearerSession | null> {
  const rawAuth = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization
  if (!rawAuth || !rawAuth.startsWith('Bearer ')) return null
  const token = rawAuth.slice(7).trim()
  if (!token) return null

  const { adminClient, authClient } = getSupabaseServerClient()
  if (!authClient) return null

  try {
    const { data, error } = await authClient.auth.getUser(token)
    if (error || !data?.user?.email) return null

    const authUid = data.user.id
    const email = data.user.email.trim().toLowerCase()
    let role: VerifiedBearerSession['role'] = 'CUSTOMER'
    let userId: number | undefined
    let customerId: number | undefined
    let branchName: string | undefined
    let fullName: string | undefined

    if (adminClient) {
      const dbLookupClient = createClient(
        process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          DEFAULT_SUPABASE_ANON_KEY,
        process.env.SUPABASE_SERVICE_ROLE_KEY
          ? undefined
          : { global: { headers: { Authorization: `Bearer ${token}` } } }
      )

      const { data: uaRows } = await dbLookupClient
        .from('user_accounts')
        .select('user_id, email, roles(role_name), branches(branch_name), customer_profiles(customer_id, first_name, last_name)')
        .eq('auth_uid', authUid)
        .limit(1)

      let row: any = Array.isArray(uaRows) ? uaRows[0] : null
      if (!row) {
        const { data: emailRows } = await dbLookupClient
          .from('user_accounts')
          .select('user_id, email, roles(role_name), branches(branch_name), customer_profiles(customer_id, first_name, last_name)')
          .ilike('email', email)
          .limit(1)
        row = Array.isArray(emailRows) ? emailRows[0] : null
      }
      if (row) {
        userId = row.user_id
        const dbRole = String(row.roles?.role_name || 'CUSTOMER').toUpperCase()
        if (dbRole === 'ADMINISTRATOR' || dbRole === 'STAFF' || dbRole === 'CUSTOMER') {
          role = dbRole
        }
        if (row.branches?.branch_name) branchName = String(row.branches.branch_name)
        const cp = Array.isArray(row.customer_profiles) ? row.customer_profiles[0] : row.customer_profiles
        if (cp?.customer_id) customerId = cp.customer_id
        if (cp) fullName = `${cp.first_name || ''} ${cp.last_name || ''}`.trim() || undefined
      }
    }

    return { authUid, email, role, userId, customerId, branchName, fullName }
  } catch {
    return null
  }
}
