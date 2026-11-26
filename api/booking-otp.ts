import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import {
  applyApiHeaders,
  checkMemoryRateLimit,
  enforceTrustedOrigin,
  escapeHtml,
  getClientIp,
  getOtpSecretOrNull,
  getSupabaseServerClient,
} from './_security.js'

async function lookupCustomerByEmail(email: string): Promise<{
  hasAccount: boolean
  customerName?: string
  preferredBranch?: string
}> {
  const emailClean = email.trim().toLowerCase()
  const { adminClient, hasServiceRole } = getSupabaseServerClient()
  if (!adminClient || !emailClean) return { hasAccount: false }

  try {
    const { data: rows } = await adminClient
      .from('user_accounts')
      .select('username, email, branches(branch_name), customer_profiles(first_name, last_name)')
      .ilike('email', emailClean)
      .limit(1)

    const userRow: any = Array.isArray(rows) ? rows[0] : null
    if (userRow) {
      const profile = Array.isArray(userRow.customer_profiles)
        ? userRow.customer_profiles[0]
        : userRow.customer_profiles
      const fullName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        : ''
      return {
        hasAccount: true,
        customerName: fullName || String(userRow.username || ''),
        preferredBranch: userRow.branches?.branch_name ? String(userRow.branches.branch_name) : undefined,
      }
    }

    if (hasServiceRole && adminClient.auth?.admin?.listUsers) {
      const { data: listData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 500 })
      const authUser = (listData?.users || []).find(
        (u: any) => String(u.email || '').trim().toLowerCase() === emailClean
      )
      if (authUser) {
        const meta = authUser.user_metadata || {}
        return {
          hasAccount: true,
          customerName: [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() || undefined,
          preferredBranch: meta.branch_name ? String(meta.branch_name) : undefined,
        }
      }
    }
  } catch {}

  return { hasAccount: false }
}

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function computeOtpHmac(secret: string, email: string, code: string, expiresAt: number): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${email.trim().toLowerCase()}:${code.trim()}:${expiresAt}`)
    .digest('hex')
}

function deriveNameFromEmail(email: string, fallbackName?: string): string {
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
  return fallbackName || local || 'Valued Customer'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiHeaders(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!enforceTrustedOrigin(req, res)) return

  const otpSecret = getOtpSecretOrNull()
  if (!otpSecret) {
    return res.status(503).json({
      ok: false,
      error: 'Verification service is not configured on the server.',
    })
  }

  const {
    action = 'send',
    email,
    code,
    token,
    expiresAt,
    customerName,
    serviceName = 'Sneaker Care Service',
    branchName = 'WashMyKicks Branch',
    scheduledAt = '',
  } = req.body ?? {}

  if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 254) {
    return res.status(400).json({ ok: false, error: 'A valid email address is required.' })
  }

  const emailClean = email.trim().toLowerCase()
  const clientIp = getClientIp(req)
  const recipientName = deriveNameFromEmail(emailClean, typeof customerName === 'string' ? customerName : undefined)

  if (action === 'verify') {
    if (!code || !token || !expiresAt) {
      return res.status(400).json({ ok: false, verified: false, error: 'Missing verification code or token.' })
    }
    if (Date.now() > Number(expiresAt)) {
      return res.status(400).json({ ok: false, verified: false, error: 'Verification code has expired. Please request a new code.' })
    }

    const tokenDigest = crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 24)
    const tokenLimit = checkMemoryRateLimit(`otp-verify-tok:${tokenDigest}`, 5, OTP_TTL_MS)
    if (!tokenLimit.allowed) {
      res.setHeader('Retry-After', String(tokenLimit.retryAfterSec))
      return res.status(429).json({
        ok: false,
        verified: false,
        error: 'Too many verification attempts for this code. Request a new code.',
      })
    }

    const ipLimit = checkMemoryRateLimit(`otp-verify-ip:${clientIp}`, 15, OTP_RATE_WINDOW_MS)
    if (!ipLimit.allowed) {
      res.setHeader('Retry-After', String(ipLimit.retryAfterSec))
      return res.status(429).json({
        ok: false,
        verified: false,
        error: 'Too many attempts from your network. Please wait a few minutes.',
      })
    }

    const expected = computeOtpHmac(otpSecret, emailClean, String(code), Number(expiresAt))
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(String(token), 'hex')
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b)
    if (!valid) {
      return res.status(400).json({ ok: false, verified: false, error: 'Invalid 6-digit verification code.' })
    }

    // Account linkage info is disclosed ONLY AFTER the caller proves inbox ownership via OTP
    const accountInfo = await lookupCustomerByEmail(emailClean)
    return res.status(200).json({
      ok: true,
      verified: true,
      hasAccount: accountInfo.hasAccount,
      customerName: accountInfo.customerName,
      preferredBranch: accountInfo.preferredBranch,
    })
  }

  // action === 'send': Enforce strict IP + per-email rate limiting before sending email
  const ipSendLimit = checkMemoryRateLimit(`otp-send-ip:${clientIp}`, 12, OTP_RATE_WINDOW_MS)
  if (!ipSendLimit.allowed) {
    res.setHeader('Retry-After', String(ipSendLimit.retryAfterSec))
    return res.status(429).json({
      ok: false,
      error: `Too many code requests. Try again in ${Math.ceil(ipSendLimit.retryAfterSec / 60)} minute(s).`,
    })
  }

  const emailSendLimit = checkMemoryRateLimit(`otp-send-email:${emailClean}`, 5, OTP_RATE_WINDOW_MS)
  if (!emailSendLimit.allowed) {
    res.setHeader('Retry-After', String(emailSendLimit.retryAfterSec))
    return res.status(429).json({
      ok: false,
      error: `Code already sent recently. Try again in ${Math.ceil(emailSendLimit.retryAfterSec / 60)} minute(s).`,
    })
  }

  // Generate 6-digit OTP on server only (never echoed in HTTP JSON; never discloses account state)
  const otpCode = String(crypto.randomInt(100000, 1000000))
  const exp = Date.now() + OTP_TTL_MS
  const signedToken = computeOtpHmac(otpSecret, emailClean, otpCode, exp)

  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(503).json({
      ok: false,
      reason: 'SMTP_NOT_CONFIGURED',
      error: 'Gmail SMTP credentials (GMAIL_USER and GMAIL_APP_PASSWORD) are not yet configured in Vercel Environment Variables.',
    })
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })

    const safeName = escapeHtml(recipientName)
    const safeService = escapeHtml(serviceName)
    const safeBranch = escapeHtml(branchName)
    const safeSchedule = escapeHtml(scheduledAt)

    await transporter.sendMail({
      from: `WashMyKicks Security <${GMAIL_USER}>`,
      to: emailClean,
      subject: `WashMyKicks — Your Booking Verification Code`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#dc2626;">WASHMYKICKS · BOOKING SECURITY VERIFICATION</div>
          <h2 style="margin:8px 0 12px;color:#111827;">Hi ${safeName}, verify your appointment</h2>
          <p style="color:#4b5563;font-size:14px;line-height:1.6;">
            Use the 6-digit verification code below to confirm your booking for <b>${safeService}</b> at <b>${safeBranch}</b>${
              safeSchedule ? ` on <b>${safeSchedule}</b>` : ''
            }.
          </p>
          <div style="margin:20px 0;padding:18px;text-align:center;background:#111827;color:#ffffff;border-radius:12px;font-size:28px;font-weight:800;letter-spacing:8px;">
            ${otpCode}
          </div>
          <p style="color:#6b7280;font-size:12px;line-height:1.5;">
            This code expires in 10 minutes. Never share this code with anyone.
          </p>
        </div>
      `,
    })

    return res.status(200).json({
      ok: true,
      token: signedToken,
      expiresAt: exp,
    })
  } catch {
    return res.status(500).json({
      ok: false,
      error: 'Failed to send verification email via SMTP.',
    })
  }
}
