import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyApiHeaders, getSupabaseServerClient, verifyBearerSession } from './_security.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiHeaders(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Allow automated Vercel Cron requests authenticated via CRON_SECRET OR an Administrator Bearer JWT
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (!isCronAuthorized) {
    const session = await verifyBearerSession(req)
    if (!session) {
      return res.status(401).json({ ok: false, error: 'Authentication required.' })
    }
    if (session.role !== 'ADMINISTRATOR') {
      return res.status(403).json({ ok: false, error: 'Administrator access required.' })
    }
  }

  const { adminClient, hasServiceRole } = getSupabaseServerClient()
  if (!adminClient || !hasServiceRole) {
    return res.status(200).json({
      ok: true,
      mode: 'local-standby',
      timestamp: new Date().toISOString(),
      message: 'Configure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run automated daily PostgreSQL backup manifests.',
    })
  }

  try {
    const { data, error } = await adminClient.rpc('fn_generate_backup_manifest')
    if (error) throw error
    return res.status(200).json({ ok: true, manifest: data })
  } catch {
    return res.status(500).json({ ok: false, error: 'Backup manifest failed' })
  }
}
