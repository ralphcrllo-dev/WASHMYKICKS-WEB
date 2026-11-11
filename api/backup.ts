import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({
      ok: true,
      mode: 'local-standby',
      timestamp: new Date().toISOString(),
      message: 'Configure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run automated daily PostgreSQL backup manifests.',
    })
  }

  try {
    const adminClient = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data, error } = await adminClient.rpc('fn_generate_backup_manifest')
    if (error) throw error
    return res.status(200).json({ ok: true, manifest: data })
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Backup manifest failed' })
  }
}
