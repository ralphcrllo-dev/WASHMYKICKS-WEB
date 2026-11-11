import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { to, reference, service } = req.body ?? {}
  if (!to || !reference || !service) return res.status(400).json({ error: 'Missing booking information' })
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return res.status(503).json({ error: 'Email is not configured' })
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })
  await transport.sendMail({ from: `WashMyKicks <${GMAIL_USER}>`, to, subject: `Booking received — ${reference}`, text: `We received your ${service} booking. Your reference is ${reference}. We’ll send your schedule confirmation shortly.` })
  return res.status(200).json({ ok: true })
}
