import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyApiHeaders } from './_security.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiHeaders(req, res)) return
  return res.status(410).json({
    ok: false,
    error: 'Deprecated endpoint. Use authenticated /api/customer-bookings.',
  })
}
