import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'
import {
  applyApiHeaders,
  checkMemoryRateLimit,
  enforceTrustedOrigin,
  escapeHtml,
  getClientIp,
  getSupabaseServerClient,
  verifyBearerSession,
} from './_security'

type NotificationEventType =
  | 'BOOKING_CONFIRMATION'
  | 'BOOKING_UPDATE'
  | 'ORDER_STATUS_UPDATE'
  | 'READY_FOR_PICKUP'
  | 'ORDER_COMPLETED'
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFICATION'

const BRANCH_ADDRESSES: { key: string; address: string }[] = [
  { key: 'pasig', address: 'West Capitol Dr., Brgy. Kapitolyo, Pasig City' },
  { key: 'san juan', address: '300 Col. Bonny Serrano Ave., San Juan City' },
  { key: 'quezon', address: 'Tomas Morato Ave. cor. Scout Lozano, Quezon City' },
  { key: 'pateros', address: '402 G. De Borja St., Brgy. Aguho, Pateros' },
  { key: 'montalban', address: 'E. Rodriguez Hwy, Brgy. San Jose, Montalban, Rizal' },
  { key: 'morong', address: '2nd Floor A5R Commercial Space Rental, Manila East Road, Morong, Rizal' },
  { key: 'bacoor', address: 'Cerritos Trails Molino 3, Bacoor, Cavite' },
]

function resolveBranchAddress(branchName?: string, explicitAddress?: string): string {
  if (explicitAddress && explicitAddress.trim()) return explicitAddress.trim()
  const lower = (branchName || '').toLowerCase()
  const matched = BRANCH_ADDRESSES.find((b) => lower.includes(b.key))
  return matched ? matched.address : ''
}

function deriveNameFromEmail(email?: string, fallbackName?: string): string {
  const genericNames = new Set(['customer', 'valued customer', 'valued sneakerhead'])
  const cleanFallback = (fallbackName || '').trim()
  if (cleanFallback && !genericNames.has(cleanFallback.toLowerCase())) {
    return cleanFallback
  }
  const local = (email || '').split('@')[0] || ''
  const cleaned = local
    .replace(/[0-9]+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .trim()
  if (cleaned) {
    return cleaned
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }
  return local || 'Valued Sneakerhead'
}

function buildEmailContent(body: {
  to?: string
  eventType: NotificationEventType
  reference?: string
  customerName?: string
  shoeName?: string
  serviceName?: string
  branchName?: string
  branchAddress?: string
  price?: string
  scheduledAt?: string
  orderStatus?: string
}) {
  const name = escapeHtml(deriveNameFromEmail(body.to, body.customerName))
  const ref = escapeHtml(body.reference || 'WMK-2026-0046')
  const pair = escapeHtml(body.shoeName || 'your sneakers')
  const svc = escapeHtml(body.serviceName || 'Sneaker Care Service')
  const branch = escapeHtml(body.branchName || 'Wash My Kicks Branch')
  const address = escapeHtml(resolveBranchAddress(body.branchName, body.branchAddress))
  const scheduled = escapeHtml(body.scheduledAt || '')
  const price = escapeHtml(body.price || '')
  const orderStatus = escapeHtml(body.orderStatus || 'In Progress')

  switch (body.eventType) {
    case 'BOOKING_CONFIRMATION':
      return {
        subject: `Wash My Kicks — Booking Confirmed (${String(body.reference || 'WMK-2026')})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#dc2626;">WASH MY KICKS · DROP-OFF CONFIRMED</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Hi ${name}, your drop-off is booked.</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Job Order: <b>${ref}</b><br/>
              Pair: <b>${pair}</b><br/>
              Service: <b>${svc}</b><br/>
              Branch: <b>${branch}</b>${address ? ` (${address})` : ''}
              ${scheduled ? `<br/>Drop-Off Slot: <b>${scheduled}</b>` : ''}
            </p>
            <div style="margin-top:16px;padding:12px 16px;background:#FDEAEA;border:1px solid #EF5350;border-radius:8px;color:#D32F2F;font-size:12px;font-weight:700;">
              Current Stage: Pending Assessment
            </div>
          </div>
        `,
      }
    case 'BOOKING_UPDATE':
      return {
        subject: `Wash My Kicks — Booking Updated (${String(body.reference || 'WMK-2026')})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#dc2626;">WASH MY KICKS · BOOKING UPDATE</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Your appointment details were updated</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Job Order <b>${ref}</b> (${svc}) at <b>${branch}</b> has been updated.
              ${scheduled ? `<br/>New Schedule: <b>${scheduled}</b>` : ''}
            </p>
          </div>
        `,
      }
    case 'READY_FOR_PICKUP':
      return {
        subject: `Wash My Kicks — Ready for Pickup at ${String(body.branchName || 'Branch').replace('Wash My Kicks – ', '')} (${String(body.reference || 'WMK-2026')})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#F57C00;">WASH MY KICKS · READY FOR PICKUP</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Hi ${name}, your pair is ready for pickup.</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              We finished checking your <b>${pair}</b> and it is ready at your preferred branch:
            </p>
            <div style="margin:16px 0;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;color:#111827;line-height:1.7;">
              <div><b>Job Order:</b> ${ref}</div>
              <div><b>Service:</b> ${svc}${price ? ` (${price})` : ''}</div>
              <div><b>Pickup Branch:</b> ${branch}</div>
              ${address ? `<div><b>Address:</b> ${address}</div>` : ''}
              <div><b>Store Hours:</b> Open daily, 10:00 AM – 8:00 PM</div>
            </div>
            <p style="color:#4b5563;font-size:13px;line-height:1.6;margin:0 0 14px;">
              Show your Job Order number (<b>${ref}</b>) at the counter. You can settle payment at the branch when you claim your pair.
            </p>
            <div style="padding:12px 16px;background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;color:#F57C00;font-size:12px;font-weight:700;">
              Status: Ready for Pickup
            </div>
          </div>
        `,
      }
    case 'ORDER_COMPLETED':
      return {
        subject: `WashMyKicks — Order Completed (${String(body.reference || 'WMK-2026')})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#2E7D32;">WASHMYKICKS · COMPLETED</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Thank you for trusting WashMyKicks!</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Job Order <b>${ref}</b> (${svc}) at <b>${branch}</b> is now marked <b>Completed</b>. We would love to hear your feedback in the Customer Portal!
            </p>
            <div style="margin-top:16px;padding:12px 16px;background:#E8F5E9;border:1px solid #66BB6A;border-radius:8px;color:#2E7D32;font-size:12px;font-weight:700;">
              Status: Completed
            </div>
          </div>
        `,
      }
    case 'PASSWORD_RESET':
      return {
        subject: 'WashMyKicks — Password Reset Request',
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#dc2626;">WASHMYKICKS · ACCOUNT SECURITY</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Reset your WashMyKicks password</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              We received a request to reset the password for your WashMyKicks account. If you did not request this, you can safely ignore this email.
            </p>
          </div>
        `,
      }
    default:
      return {
        subject: `WashMyKicks — Order Status Update (${String(body.reference || 'WMK-2026')})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#1976D2;">WASHMYKICKS · ORDER STATUS UPDATE</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Update on Job Order ${ref}</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Your sneaker care order (${svc}) at <b>${branch}</b> is now in stage: <b>${orderStatus}</b>.
            </p>
          </div>
        `,
      }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiHeaders(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!enforceTrustedOrigin(req, res)) return

  const clientIp = getClientIp(req)
  const rate = checkMemoryRateLimit(`notif-post:${clientIp}`, 20, 15 * 60 * 1000)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    return res.status(429).json({ error: 'Too many notification requests.' })
  }

  // Require authenticated Bearer session (closes open SMTP relay / spoofing)
  const session = await verifyBearerSession(req)
  if (!session) {
    return res.status(401).json({ error: 'Authentication required to send notifications.' })
  }

  const { to, eventType = 'ORDER_STATUS_UPDATE', notificationId, ...rest } = req.body ?? {}
  const toClean = String(to || '').trim().toLowerCase()
  if (!toClean || !toClean.includes('@') || toClean.length > 254) {
    return res.status(400).json({ error: 'Valid recipient email ("to") is required' })
  }

  // Enforce RBAC on notification dispatch
  const isStaffOrAdmin = session.role === 'STAFF' || session.role === 'ADMINISTRATOR'
  const isSelfBooking =
    (eventType === 'BOOKING_CONFIRMATION' || eventType === 'BOOKING_UPDATE') && toClean === session.email
  if (!isStaffOrAdmin && !isSelfBooking) {
    return res.status(403).json({ error: 'Insufficient permissions to dispatch this notification.' })
  }

  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(503).json({ error: 'Gmail SMTP credentials (GMAIL_USER / GMAIL_APP_PASSWORD) are not configured' })
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })

    const { subject, html } = buildEmailContent({ to: toClean, eventType, ...rest })

    await transporter.sendMail({
      from: `WashMyKicks Sneaker Care <${GMAIL_USER}>`,
      to: toClean,
      subject,
      html,
    })

    const { adminClient, hasServiceRole } = getSupabaseServerClient()
    if (notificationId && adminClient && hasServiceRole) {
      await adminClient
        .from('notifications')
        .update({ delivery_status: 'Sent', sent_at: new Date().toISOString() })
        .eq('notification_id', notificationId)
    }

    return res.status(200).json({ ok: true, eventType, to: toClean })
  } catch {
    return res.status(500).json({ error: 'Failed to send email via SMTP' })
  }
}
