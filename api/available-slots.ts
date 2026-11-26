import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyApiHeaders, checkMemoryRateLimit, getClientIp, getSupabaseServerClient } from './_security.js'

const DEFAULT_TIME_SLOTS = [
  '10:00 AM',
  '10:30 AM',
  '11:30 AM',
  '01:00 PM',
  '02:30 PM',
  '04:00 PM',
  '05:30 PM',
  '06:30 PM',
]

const MAX_CAPACITY_PER_SLOT = 2

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiHeaders(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rate = checkMemoryRateLimit(`slots:${getClientIp(req)}`, 60, 60 * 1000)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ ok: false, error: 'Too many requests.' })
  }

  const branchName = String(req.query.branch || 'Wash My Kicks – Pasig City')
  const dateLabel = String(req.query.date || '')

  const { adminClient, hasServiceRole } = getSupabaseServerClient()

  const slotCounts: Record<string, number> = {}
  for (const s of DEFAULT_TIME_SLOTS) slotCounts[s] = 0

  try {
    if (adminClient) {
      if (hasServiceRole) {
        const { data: bookings } = await adminClient
          .from('bookings')
          .select('scheduled_at, booking_status, customer_request')
          .neq('booking_status', 'Cancelled')

        if (Array.isArray(bookings)) {
          for (const b of bookings) {
            const reqText = String(b.customer_request || '')
            for (const slot of DEFAULT_TIME_SLOTS) {
              if (reqText.includes(slot) && (!dateLabel || reqText.includes(dateLabel))) {
                slotCounts[slot] = (slotCounts[slot] || 0) + 1
              }
            }
          }
        }
      } else {
        const { data: rpcRows } = await adminClient.rpc('fn_get_public_slot_counts', {
          p_date_label: dateLabel,
        })
        if (Array.isArray(rpcRows)) {
          for (const r of rpcRows as any[]) {
            if (r?.slot_label && r.slot_label in slotCounts) {
              slotCounts[String(r.slot_label)] = Number(r.booked_count || 0)
            }
          }
        }
      }
    }
  } catch {
    // Graceful fallback if database query fails
  }

  const slots = DEFAULT_TIME_SLOTS.map((slot) => {
    const booked = slotCounts[slot] || 0
    const remaining = Math.max(0, MAX_CAPACITY_PER_SLOT - booked)
    return {
      slot,
      booked,
      capacity: MAX_CAPACITY_PER_SLOT,
      remaining,
      available: remaining > 0,
    }
  })

  return res.status(200).json({
    ok: true,
    branch: branchName,
    date: dateLabel,
    slots,
  })
}
