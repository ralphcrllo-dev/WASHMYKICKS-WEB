import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const branchName = String(req.query.branch || 'Wash My Kicks – Pasig City')
  const dateLabel = String(req.query.date || '')

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://mwqtenuykrdlspxhgdlw.supabase.co'
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_NvYSYfPuqL04mnkD8BSnXw_uEOMtGam'

  const slotCounts: Record<string, number> = {}
  for (const s of DEFAULT_TIME_SLOTS) slotCounts[s] = 0

  try {
    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey)
      const { data: bookings } = await client
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
