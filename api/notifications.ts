import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

type NotificationEventType =
  | 'BOOKING_CONFIRMATION'
  | 'BOOKING_UPDATE'
  | 'ORDER_STATUS_UPDATE'
  | 'READY_FOR_PICKUP'
  | 'ORDER_COMPLETED'
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFICATION'

function buildEmailContent(body: {
  eventType: NotificationEventType
  reference?: string
  customerName?: string
  serviceName?: string
  branchName?: string
  scheduledAt?: string
  orderStatus?: string
  actionUrl?: string
}) {
  const name = body.customerName || 'Valued Sneakerhead'
  const ref = body.reference || 'WMK-2026-0046'
  const svc = body.serviceName || 'Sneaker Care Service'
  const branch = body.branchName || 'WashMyKicks Branch'

  switch (body.eventType) {
    case 'BOOKING_CONFIRMATION':
      return {
        subject: `WashMyKicks — Booking Confirmed (${ref})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#dc2626;">WASHMYKICKS · BOOKING CONFIRMATION</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Hi ${name}, your appointment is confirmed!</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Your booking reference is <b>${ref}</b> for <b>${svc}</b> at <b>${branch}</b>.
              ${body.scheduledAt ? `<br/>Scheduled Drop-Off: <b>${body.scheduledAt}</b>` : ''}
            </p>
            <div style="margin-top:16px;padding:12px 16px;background:#FDEAEA;border:1px solid #EF5350;border-radius:8px;color:#D32F2F;font-size:12px;font-weight:700;">
              Current Stage: Pending Assessment
            </div>
          </div>
        `,
      }
    case 'BOOKING_UPDATE':
      return {
        subject: `WashMyKicks — Booking Updated (${ref})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#dc2626;">WASHMYKICKS · BOOKING UPDATE</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Your appointment details were updated</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Job Order <b>${ref}</b> (${svc}) at <b>${branch}</b> has been updated.
              ${body.scheduledAt ? `<br/>New Schedule: <b>${body.scheduledAt}</b>` : ''}
            </p>
          </div>
        `,
      }
    case 'READY_FOR_PICKUP':
      return {
        subject: `WashMyKicks — Your Kicks Are Ready for Pickup! (${ref})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#F57C00;">WASHMYKICKS · READY FOR PICKUP</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Good news, ${name}!</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Your pair under Job Order <b>${ref}</b> (${svc}) has passed our 5-point Quality Check and is waiting for collection at <b>${branch}</b>.
            </p>
            <div style="margin-top:16px;padding:12px 16px;background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;color:#F57C00;font-size:12px;font-weight:700;">
              Status: Ready for Pickup
            </div>
          </div>
        `,
      }
    case 'ORDER_COMPLETED':
      return {
        subject: `WashMyKicks — Order Completed (${ref})`,
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
    case 'EMAIL_VERIFICATION':
      return {
        subject: 'WashMyKicks — Verify Your Email Address',
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#dc2626;">WASHMYKICKS · EMAIL VERIFICATION</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Welcome to WashMyKicks, ${name}!</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Please verify your email address to activate full Customer Portal access for booking appointments and tracking shoe orders.
            </p>
          </div>
        `,
      }
    default:
      return {
        subject: `WashMyKicks — Order Status Update: ${body.orderStatus || 'In Progress'} (${ref})`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#1976D2;">WASHMYKICKS · ORDER STATUS UPDATE</div>
            <h2 style="margin:8px 0 12px;color:#111827;">Update on Job Order ${ref}</h2>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Your sneaker care order (${svc}) at <b>${branch}</b> is now in stage: <b>${body.orderStatus || 'In Progress'}</b>.
            </p>
          </div>
        `,
      }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, eventType = 'ORDER_STATUS_UPDATE', notificationId, ...rest } = req.body ?? {}
  if (!to) {
    return res.status(400).json({ error: 'Recipient email ("to") is required' })
  }

  const { GMAIL_USER, GMAIL_APP_PASSWORD, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
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

    const { subject, html } = buildEmailContent({ eventType, ...rest })

    await transporter.sendMail({
      from: `WashMyKicks Sneaker Care <${GMAIL_USER}>`,
      to,
      subject,
      html,
    })

    // Mark notification as Sent in Supabase PostgreSQL if notificationId is provided
    if (notificationId && VITE_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      await adminClient
        .from('notifications')
        .update({ delivery_status: 'Sent', sent_at: new Date().toISOString() })
        .eq('notification_id', notificationId)
    }

    return res.status(200).json({ ok: true, eventType, to })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send email via Gmail SMTP' })
  }
}
