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
  verifyBearerSession,
} from './_security.js'

const consumedOtpTokens = new Set<string>()

function verifyOtpSignature(email: string, code: string, token: string, expiresAt: number): boolean {
  const secret = getOtpSecretOrNull()
  if (!secret || !email || !code || !token || !expiresAt || Date.now() > Number(expiresAt)) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${email.trim().toLowerCase()}:${code.trim()}:${expiresAt}`)
    .digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(String(token), 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function deriveNameFromEmail(email?: string, fallbackName?: string): string {
  const generic = new Set(['customer', 'valued customer', 'valued sneakerhead'])
  const clean = (fallbackName || '').trim()
  if (clean && !generic.has(clean.toLowerCase())) return clean
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
  return local || 'Customer'
}

function extractEmbeddedEmail(text: string): string {
  const match = String(text || '').match(/\[Email:\s*([^\s\]]+@[^\s\]]+)\]/i)
  return match ? match[1].trim().toLowerCase() : ''
}

function extractEmbeddedSchedule(text: string): { date?: string; time?: string } {
  const match = String(text || '').match(/\(([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*·\s*([^)]+)\)/)
  if (!match) return {}
  return { date: match[1].trim(), time: match[2].trim() }
}

async function lookupCustomerByEmail(client: any, rawEmail: string) {
  const emailClean = rawEmail.trim().toLowerCase()
  if (!emailClean || !client) return { hasAccount: false as const }

  try {
    const { data: rows } = await client
      .from('user_accounts')
      .select(
        'user_id, auth_uid, username, email, account_status, roles(role_name), branches(branch_name), customer_profiles(customer_id, first_name, last_name)'
      )
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
      const roleName = String(userRow.roles?.role_name || 'CUSTOMER').toUpperCase()
      return {
        hasAccount: true as const,
        userId: userRow.user_id as number,
        customerId: (profile?.customer_id as number | undefined) ?? undefined,
        role: roleName,
        customerName: fullName || String(userRow.username || deriveNameFromEmail(emailClean)),
        preferredBranch: userRow.branches?.branch_name ? String(userRow.branches.branch_name) : undefined,
      }
    }
  } catch {}

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && client.auth?.admin?.listUsers) {
    try {
      const { data: listData } = await client.auth.admin.listUsers({ page: 1, perPage: 500 })
      const authUser = (listData?.users || []).find(
        (u: any) => String(u.email || '').trim().toLowerCase() === emailClean
      )
      if (authUser) {
        const meta = authUser.user_metadata || {}
        const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim()
        return {
          hasAccount: true as const,
          role: String(meta.role || 'CUSTOMER').toUpperCase(),
          customerName: fullName || deriveNameFromEmail(emailClean),
          preferredBranch: meta.branch_name ? String(meta.branch_name) : undefined,
        }
      }
    } catch {}
  }

  return { hasAccount: false as const }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyApiHeaders(req, res)) return

  const { adminClient } = getSupabaseServerClient()
  const clientIp = getClientIp(req)

  // GET requires an authenticated Bearer session JWT (closes both email enumeration & order PII dumps)
  if (req.method === 'GET') {
    const rate = checkMemoryRateLimit(`cust-get:${clientIp}`, 60, 60 * 1000)
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec))
      return res.status(429).json({ ok: false, error: 'Too many requests.' })
    }

    const session = await verifyBearerSession(req)
    if (!session) {
      return res.status(401).json({ ok: false, error: 'Authentication required.' })
    }

    const requestedEmail = String(req.query.email || '').trim().toLowerCase()
    const mode = String(req.query.mode || 'lookup')

    if (!adminClient) {
      return res.status(200).json({ ok: true, hasAccount: false, orders: [] })
    }

    if (mode === 'orders') {
      // Customers may only query their own verified email; Staff scoped to their branch; Admin unrestricted
      const isPrivileged = session.role === 'ADMINISTRATOR' || session.role === 'STAFF'
      if (!isPrivileged && requestedEmail && requestedEmail !== session.email) {
        return res.status(403).json({ ok: false, error: 'Access denied for requested customer email.' })
      }
      const targetEmail = isPrivileged ? requestedEmail : session.email

      try {
        const { data: soRows } = await adminClient
          .from('service_orders')
          .select(
            `
            order_id,
            order_number,
            order_status,
            work_instructions,
            progress_notes,
            received_at,
            bookings (
              booking_id,
              scheduled_at,
              price_at_booking,
              customer_request,
              customer_profiles (
                first_name,
                last_name,
                user_accounts ( email )
              ),
              branch_services (
                service_price,
                branches ( branch_name ),
                shoe_services ( service_name )
              )
            ),
            shoe_assessments (
              assessment_status,
              damage_findings,
              service_notes
            )
          `
          )
          .order('order_id', { ascending: false })

        const mapped = (Array.isArray(soRows) ? soRows : [])
          .map((row: any) => {
            const bk = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
            const cp = bk?.customer_profiles
            const ua = Array.isArray(cp?.user_accounts) ? cp?.user_accounts[0] : cp?.user_accounts
            const bs = bk?.branch_services
            const br = bs?.branches
            const ss = bs?.shoe_services
            const sa = Array.isArray(row.shoe_assessments) ? row.shoe_assessments[0] : row.shoe_assessments

            const rawReq = String(bk?.customer_request || row.work_instructions || '')
            const embeddedEmail = extractEmbeddedEmail(rawReq)
            const uaEmail = String(ua?.email || '').trim().toLowerCase()
            const orderEmail = embeddedEmail || uaEmail
            const shoeTitle = rawReq.split('—')[0]?.trim() || 'Sneaker Pair'
            const fullName =
              embeddedEmail && uaEmail && embeddedEmail !== uaEmail
                ? ''
                : cp
                ? `${cp.first_name || ''} ${cp.last_name || ''}`.trim()
                : ''
            const embeddedSched = extractEmbeddedSchedule(rawReq)
            const sched = bk?.scheduled_at ? new Date(bk.scheduled_at) : new Date(row.received_at || Date.now())
            const dateStr =
              embeddedSched.date ||
              sched.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            const timeStr =
              embeddedSched.time ||
              sched.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            const priceNum = Number(bk?.price_at_booking ?? bs?.service_price ?? 650)

            return {
              id: String(row.order_number || `WMK-2026-${String(row.order_id).padStart(4, '0')}`),
              customer:
                (fullName && fullName !== 'Juan Dela Cruz' ? fullName : '') ||
                deriveNameFromEmail(orderEmail),
              email: orderEmail,
              shoe: shoeTitle,
              service: ss?.service_name || 'Deep Cleaning',
              branch: br?.branch_name || 'Wash My Kicks – Pasig City',
              date: dateStr,
              time: timeStr,
              price: `₱${priceNum.toLocaleString()}`,
              status: String(row.order_status || 'Pending Assessment'),
              assessed: sa?.assessment_status === 'Completed' || sa?.assessment_status === 'Approved',
              assessmentNotes: sa?.damage_findings || sa?.service_notes || undefined,
            }
          })
          .filter((ord) => {
            if (targetEmail && ord.email.toLowerCase() !== targetEmail) return false
            if (session.role === 'STAFF' && session.branchName) {
              return ord.branch.toLowerCase() === session.branchName.toLowerCase()
            }
            return true
          })

        return res.status(200).json({ ok: true, orders: mapped })
      } catch {
        return res.status(500).json({ ok: false, orders: [], error: 'Failed to retrieve orders.' })
      }
    }

    // Authenticated self-lookup only (or Staff/Admin)
    const lookupEmail = requestedEmail || session.email
    if (session.role === 'CUSTOMER' && lookupEmail !== session.email) {
      return res.status(403).json({ ok: false, error: 'Cannot look up third-party accounts.' })
    }
    const account = await lookupCustomerByEmail(adminClient, lookupEmail)
    return res.status(200).json({
      ok: true,
      hasAccount: account.hasAccount,
      role: account.hasAccount ? account.role : undefined,
      preferredBranch: account.hasAccount ? account.preferredBranch : undefined,
    })
  }

  // POST: Save booking strictly with verified OTP proof OR verified Bearer JWT
  if (req.method === 'POST') {
    if (!enforceTrustedOrigin(req, res)) return

    const postRate = checkMemoryRateLimit(`cust-post:${clientIp}`, 10, 15 * 60 * 1000)
    if (!postRate.allowed) {
      res.setHeader('Retry-After', String(postRate.retryAfterSec))
      return res.status(429).json({ ok: false, error: 'Too many booking requests. Please try again later.' })
    }

    const {
      orderNumber,
      customerEmail,
      customerName,
      branchId = 1,
      branchName = 'Wash My Kicks – Pasig City',
      serviceName = 'Deep Cleaning',
      scheduledAt,
      priceAtBooking = 650,
      customerRequest,
      otpCode,
      otpToken,
      otpExpiresAt,
    } = req.body ?? {}

    const emailClean = String(customerEmail || '').trim().toLowerCase()
    if (!emailClean || !emailClean.includes('@') || emailClean.length > 254) {
      return res.status(400).json({ ok: false, error: 'Valid customer email is required.' })
    }

    const session = await verifyBearerSession(req)
    const sessionAuthorized =
      Boolean(session) &&
      (session!.email === emailClean || session!.role === 'STAFF' || session!.role === 'ADMINISTRATOR')

    const tokenKey = otpToken ? crypto.createHash('sha256').update(String(otpToken)).digest('hex') : ''
    const otpValid =
      Boolean(otpCode && otpToken && otpExpiresAt) &&
      !consumedOtpTokens.has(tokenKey) &&
      verifyOtpSignature(emailClean, String(otpCode), String(otpToken), Number(otpExpiresAt))

    if (!sessionAuthorized && !otpValid) {
      return res.status(401).json({
        ok: false,
        error: 'Valid email verification code or signed-in session is required before booking.',
      })
    }

    if (otpValid && tokenKey) {
      if (consumedOtpTokens.size > 5000) consumedOtpTokens.clear()
      consumedOtpTokens.add(tokenKey)
    }

    let linkedAccount: Awaited<ReturnType<typeof lookupCustomerByEmail>> = { hasAccount: false }
    let createdBookingId: number | null = null

    if (adminClient) {
      linkedAccount = await lookupCustomerByEmail(adminClient, emailClean)

      try {
        let resolvedCustomerId: number | null = linkedAccount.hasAccount ? linkedAccount.customerId ?? null : null

        if (!resolvedCustomerId && linkedAccount.hasAccount && linkedAccount.userId) {
          const nameParts = deriveNameFromEmail(emailClean, customerName || linkedAccount.customerName).split(/\s+/)
          const { data: createdProfile } = await adminClient
            .from('customer_profiles')
            .insert({
              user_id: linkedAccount.userId,
              first_name: nameParts[0] || 'Customer',
              last_name: nameParts.slice(1).join(' ') || 'Account',
            })
            .select('customer_id')
            .single()
          if (createdProfile?.customer_id) resolvedCustomerId = createdProfile.customer_id
        }

        if (!resolvedCustomerId) {
          const { data: firstProfile } = await adminClient
            .from('customer_profiles')
            .select('customer_id')
            .order('customer_id', { ascending: true })
            .limit(1)
            .maybeSingle()
          if (firstProfile?.customer_id) resolvedCustomerId = firstProfile.customer_id
        }

        let resolvedBranchServiceId = Number(branchId) || 1
        try {
          const { data: bsRows } = await adminClient
            .from('branch_services')
            .select('branch_service_id, branch_id, shoe_services!inner(service_name)')
            .eq('branch_id', Number(branchId) || 1)
          if (Array.isArray(bsRows) && bsRows.length > 0) {
            const exactSvc = bsRows.find(
              (r: any) => String(r.shoe_services?.service_name || '').toLowerCase() === String(serviceName).toLowerCase()
            )
            resolvedBranchServiceId = exactSvc?.branch_service_id || bsRows[0].branch_service_id
          }
        } catch {}

        const requestWithEmail = `${String(customerRequest || serviceName)} [Email: ${emailClean}]`

        if (resolvedCustomerId) {
          const { data: bookingRow } = await adminClient
            .from('bookings')
            .insert({
              customer_id: resolvedCustomerId,
              branch_service_id: resolvedBranchServiceId,
              scheduled_at: scheduledAt || new Date().toISOString(),
              price_at_booking: Number(priceAtBooking) || 650,
              booking_status: 'Confirmed',
              customer_request: requestWithEmail,
            })
            .select('booking_id')
            .single()

          if (bookingRow?.booking_id) {
            createdBookingId = bookingRow.booking_id
            if (orderNumber) {
              await adminClient
                .from('service_orders')
                .update({ order_number: String(orderNumber) })
                .eq('booking_id', createdBookingId)
            }
          }
        }
      } catch {}
    }

    const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env
    const resolvedName =
      (linkedAccount.hasAccount && linkedAccount.customerName) ||
      deriveNameFromEmail(emailClean, typeof customerName === 'string' ? customerName : undefined)
    let emailSent = false

    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        })
        const ref = String(
          orderNumber || `WMK-${new Date().getFullYear()}-${String(createdBookingId || 1).padStart(4, '0')}`
        )
        const safeName = escapeHtml(resolvedName)
        const safeRef = escapeHtml(ref)
        const safeService = escapeHtml(serviceName)
        const safeBranch = escapeHtml(branchName)

        await transporter.sendMail({
          from: `WashMyKicks Sneaker Care <${GMAIL_USER}>`,
          to: emailClean,
          subject: `Wash My Kicks — Booking Confirmed (${ref})`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;border:1px solid #e5e7eb;border-radius:14px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#dc2626;">WASH MY KICKS · DROP-OFF CONFIRMED</div>
              <h2 style="margin:8px 0 12px;color:#111827;">Hi ${safeName}, your drop-off is booked.</h2>
              <p style="color:#4b5563;font-size:14px;line-height:1.6;">
                Job Order: <b>${safeRef}</b><br/>
                Service: <b>${safeService}</b><br/>
                Branch: <b>${safeBranch}</b>
                ${linkedAccount.hasAccount ? '<br/><b>Account Sync:</b> Linked to your Customer Dashboard.' : ''}
              </p>
              <div style="margin-top:16px;padding:12px 16px;background:#FDEAEA;border:1px solid #EF5350;border-radius:8px;color:#D32F2F;font-size:12px;font-weight:700;">
                Current Stage: Pending Assessment
              </div>
            </div>
          `,
        })
        emailSent = true
      } catch {}
    }

    return res.status(200).json({
      ok: true,
      hasAccount: linkedAccount.hasAccount,
      customerName: resolvedName,
      bookingId: createdBookingId,
      otpVerifiedOnServer: otpValid || sessionAuthorized,
      emailSent,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
