/* ============================================================================
   WASHMYKICKS — ENTERPRISE API, AUTH, STORAGE, RBAC & NOTIFICATION LAYER
   Implements all 7 ERD Modules with Supabase PostgreSQL, Auth, Storage & SMTP
   ============================================================================ */

import { supabase, isSupabaseConfigured } from './supabase'
import type {
  AssessmentPhotoType,
  ErdAssessmentPhoto,
  ErdAuditLog,
  ErdBooking,
  ErdCrmInteraction,
  ErdCustomerNotificationPreference,
  ErdCustomerProfile,
  ErdNotification,
  ErdPurchaseOrder,
  ErdServiceOrder,
  ErdShoeAssessment,
  ErdStockMovement,
  ErdSupplierReturn,
  ErdSystemSetting,
  OrderStatus,
  RoleName,
  StockMovementType,
  ViewBranchInventoryStock,
  ViewOrderTrackingDetails,
} from './database.types'

/* ============================================================================
   CLIENT-SIDE + DB BRUTE-FORCE RATE LIMITER
   ============================================================================ */

const LOCAL_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_ATTEMPTS = 5
const failedLoginTracker = new Map<string, number[]>()

export function checkClientBruteForceGuard(email: string): { allowed: boolean; remainingAttempts: number } {
  const key = email.trim().toLowerCase()
  const now = Date.now()
  const recent = (failedLoginTracker.get(key) || []).filter((ts) => now - ts < LOCAL_ATTEMPT_WINDOW_MS)
  failedLoginTracker.set(key, recent)
  return {
    allowed: recent.length < MAX_FAILED_ATTEMPTS,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - recent.length),
  }
}

export function recordClientLoginAttempt(email: string, success: boolean): void {
  const key = email.trim().toLowerCase()
  if (success) {
    failedLoginTracker.delete(key)
    return
  }
  const recent = failedLoginTracker.get(key) || []
  recent.push(Date.now())
  failedLoginTracker.set(key, recent)
}

/* ============================================================================
   EMAIL NOTIFICATION DISPATCHER (GMAIL SMTP SERVERLESS API)
   ============================================================================ */

export type EmailNotificationPayload = {
  to: string
  eventType:
    | 'BOOKING_CONFIRMATION'
    | 'BOOKING_UPDATE'
    | 'ORDER_STATUS_UPDATE'
    | 'READY_FOR_PICKUP'
    | 'ORDER_COMPLETED'
    | 'PASSWORD_RESET'
    | 'EMAIL_VERIFICATION'
  reference?: string
  customerName?: string
  serviceName?: string
  branchName?: string
  scheduledAt?: string
  orderStatus?: OrderStatus
  actionUrl?: string
  customMessage?: string
}

export async function dispatchTransactionalEmail(payload: EmailNotificationPayload): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false }
    return { ok: true }
  } catch {
    // Graceful fallback when running static preview without serverless runtime
    return { ok: false }
  }
}

/* ============================================================================
   MODULE 1: CUSTOMER MANAGEMENT & ROLE-BASED AUTHENTICATION
   Tables: roles, user_accounts, customer_profiles
   ============================================================================ */

export async function registerCustomerAccount(input: {
  email: string
  password: string
  username?: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  role?: RoleName
  branchId?: number
  branchName?: string
  employeeId?: string
}) {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase Auth is not configured.')
  }

  const targetRole: RoleName = input.role || 'CUSTOMER'
  const username =
    input.username || `${input.firstName.toLowerCase().replace(/\s+/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        role: targetRole,
        username,
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone || '',
        address: input.address || '',
        branch_id: input.branchId ? String(input.branchId) : '',
        branch_name: input.branchName || '',
        employee_id: input.employeeId || '',
      },
    },
  })

  if (error) throw error

  await dispatchTransactionalEmail({
    to: input.email.trim(),
    eventType: 'EMAIL_VERIFICATION',
    customerName: `${input.firstName} ${input.lastName}`,
  })

  return { mode: 'supabase' as const, user: data.user }
}

export async function signInWithRole(input: {
  email: string
  password: string
  expectedRole: RoleName
  branchId?: number
  branchName?: string
  employeeId?: string
}) {
  const guard = checkClientBruteForceGuard(input.email)
  if (!guard.allowed) {
    throw new Error('Account temporarily locked due to too many failed login attempts. Please wait 15 minutes.')
  }

  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase Auth is required for authentication.')
  }

  // Check database-enforced rate limit before attempting sign-in
  try {
    const { data: allowedByDb } = await supabase.rpc('fn_check_login_rate_limit', {
      p_email: input.email.trim(),
    })
    if (allowedByDb === false) {
      throw new Error('Account is locked due to repeated failed login attempts.')
    }
  } catch (rateErr: any) {
    if (String(rateErr?.message || '').includes('locked')) throw rateErr
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })

  if (error || !data.user) {
    recordClientLoginAttempt(input.email, false)
    try {
      await supabase.rpc('fn_record_auth_event', {
        p_action: 'LOGIN_FAILED',
        p_email: input.email.trim(),
      })
    } catch {}
    throw error || new Error('Invalid login credentials.')
  }

  // Verify role & branch assignment in user_accounts -> roles or auth metadata
  let accountRow: any = null
  try {
    const { data: row } = await supabase
      .from('user_accounts')
      .select('user_id, role_id, branch_id, account_status, roles(role_name)')
      .eq('auth_uid', data.user.id)
      .single()
    accountRow = row
  } catch {}

  if (accountRow && accountRow.account_status === 'LOCKED') {
    await supabase.auth.signOut()
    throw new Error('This account is locked. Please contact an administrator.')
  }

  const metaRole = String(data.user.user_metadata?.role || '').toUpperCase()
  const dbRole = String(accountRow?.roles?.role_name || metaRole || 'CUSTOMER').toUpperCase()
  if (dbRole && dbRole !== input.expectedRole) {
    await supabase.auth.signOut()
    throw new Error(`Access denied: this account is registered as ${dbRole}, not ${input.expectedRole}.`)
  }

  if (input.expectedRole === 'STAFF' && input.branchName) {
    const assignedBranch = String(data.user.user_metadata?.branch_name || '')
    if (assignedBranch && assignedBranch !== input.branchName) {
      await supabase.auth.signOut()
      throw new Error(`Branch access denied: your staff account is provisioned for ${assignedBranch}.`)
    }
  }

  recordClientLoginAttempt(input.email, true)
  try {
    await supabase.rpc('fn_record_auth_event', {
      p_action: 'LOGIN',
      p_email: input.email.trim(),
    })
  } catch {}

  return { mode: 'supabase' as const, user: data.user, account: accountRow }
}

export async function signOutSession(email?: string) {
  if (supabase && isSupabaseConfigured) {
    await supabase.rpc('fn_record_auth_event', {
      p_action: 'LOGOUT',
      p_email: email || null,
    })
    await supabase.auth.signOut()
  }
}

export async function requestPasswordResetEmail(email: string) {
  if (supabase && isSupabaseConfigured) {
    await supabase.auth.resetPasswordForEmail(email)
  }
  await dispatchTransactionalEmail({
    to: email,
    eventType: 'PASSWORD_RESET',
  })
}

export async function updateCustomerProfileRecord(
  customerId: number,
  updates: Partial<Pick<ErdCustomerProfile, 'first_name' | 'last_name' | 'phone' | 'address'>>
) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('customer_profiles')
    .update(updates)
    .eq('customer_id', customerId)
    .select()
    .single()
  if (error) throw error
  return data as ErdCustomerProfile
}

/* ============================================================================
   MODULE 2: SHOE BOOKING MANAGEMENT
   Tables: branches, branch_hours, shoe_services, branch_services, bookings
   ============================================================================ */

export async function createBookingRecord(input: {
  customerId: number
  branchServiceId: number
  scheduledAt: string
  priceAtBooking: number
  customerRequest?: string
  customerEmail?: string
  customerName?: string
  serviceName?: string
  branchName?: string
}) {
  if (supabase && isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: input.customerId,
        branch_service_id: input.branchServiceId,
        scheduled_at: input.scheduledAt,
        price_at_booking: input.priceAtBooking,
        booking_status: 'Confirmed',
        customer_request: input.customerRequest || null,
      })
      .select()
      .single()

    if (error) throw error

    if (input.customerEmail) {
      await dispatchTransactionalEmail({
        to: input.customerEmail,
        eventType: 'BOOKING_CONFIRMATION',
        reference: `WMK-${new Date().getFullYear()}-${String(data.booking_id).padStart(4, '0')}`,
        customerName: input.customerName,
        serviceName: input.serviceName,
        branchName: input.branchName,
        scheduledAt: input.scheduledAt,
      })
    }

    return data as ErdBooking
  }
  return null
}

/* ============================================================================
   MODULE 3: CUSTOMER RELATIONSHIP MANAGEMENT (CRM)
   Tables: crm_interactions, notifications, notification_contexts,
           customer_notification_preferences
   ============================================================================ */

export async function submitCustomerCrmInteraction(input: {
  customerId: number
  interactionType: ErdCrmInteraction['interaction_type']
  customerMessage: string
  rating?: number
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('crm_interactions')
    .insert({
      customer_id: input.customerId,
      interaction_type: input.interactionType,
      customer_message: input.customerMessage,
      rating: input.rating ?? null,
      interaction_status: input.interactionType === 'REVIEW' ? 'Published' : 'Open',
    })
    .select()
    .single()
  if (error) throw error
  return data as ErdCrmInteraction
}

export async function fetchCustomerNotifications(customerId: number) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*, notification_contexts(booking_id, order_id)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as (ErdNotification & { notification_contexts?: { booking_id: number | null; order_id: number | null } })[]
}

export async function updateNotificationPreference(
  customerId: number,
  preferenceType: string,
  isEnabled: boolean
) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('customer_notification_preferences')
    .upsert(
      {
        customer_id: customerId,
        preference_type: preferenceType,
        is_enabled: isEnabled,
      },
      { onConflict: 'customer_id,preference_type' }
    )
    .select()
    .single()
  if (error) throw error
  return data as ErdCustomerNotificationPreference
}

/* ============================================================================
   MODULE 4: ORDER MANAGEMENT
   Tables: service_orders
   Workflow: Pending Assessment -> In Progress -> Quality Check -> Ready for Pickup -> Completed
   ============================================================================ */

export async function fetchOrderTrackingDetails(orderNumber?: string): Promise<ViewOrderTrackingDetails[]> {
  if (!supabase) return []
  let query = supabase.from('v_order_tracking_details').select('*')
  if (orderNumber) {
    query = query.eq('order_number', orderNumber)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []) as ViewOrderTrackingDetails[]
}

export async function updateServiceOrderStatus(input: {
  orderId?: number
  orderNumber: string
  nextStatus: OrderStatus
  progressNotes?: string
  customerEmail?: string
  customerName?: string
  serviceName?: string
  branchName?: string
}) {
  if (supabase && isSupabaseConfigured) {
    const query = supabase
      .from('service_orders')
      .update({
        order_status: input.nextStatus,
        progress_notes: input.progressNotes,
        completed_at: input.nextStatus === 'Completed' ? new Date().toISOString() : undefined,
      })

    const { data, error } = input.orderId
      ? await query.eq('order_id', input.orderId).select().single()
      : await query.eq('order_number', input.orderNumber).select().single()

    if (error) throw error

    if (input.customerEmail) {
      const eventType =
        input.nextStatus === 'Ready for Pickup'
          ? 'READY_FOR_PICKUP'
          : input.nextStatus === 'Completed'
          ? 'ORDER_COMPLETED'
          : 'ORDER_STATUS_UPDATE'

      await dispatchTransactionalEmail({
        to: input.customerEmail,
        eventType,
        reference: input.orderNumber,
        customerName: input.customerName,
        serviceName: input.serviceName,
        branchName: input.branchName,
        orderStatus: input.nextStatus,
      })
    }

    return data as ErdServiceOrder
  }

  if (input.customerEmail) {
    const eventType =
      input.nextStatus === 'Ready for Pickup'
        ? 'READY_FOR_PICKUP'
        : input.nextStatus === 'Completed'
        ? 'ORDER_COMPLETED'
        : 'ORDER_STATUS_UPDATE'

    await dispatchTransactionalEmail({
      to: input.customerEmail,
      eventType,
      reference: input.orderNumber,
      customerName: input.customerName,
      serviceName: input.serviceName,
      branchName: input.branchName,
      orderStatus: input.nextStatus,
    })
  }

  return null
}

/* ============================================================================
   MODULE 5: INVENTORY MANAGEMENT
   Tables: suppliers, inventory_items, purchase_orders, purchase_order_items,
           deliveries, delivery_items, branch_inventory, stock_movements,
           supplier_returns
   ============================================================================ */

export async function fetchLiveBranchInventory(branchId?: number): Promise<ViewBranchInventoryStock[]> {
  if (!supabase) return []
  let query = supabase.from('v_branch_inventory_stock').select('*')
  if (branchId) query = query.eq('branch_id', branchId)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as ViewBranchInventoryStock[]
}

export async function recordStockMovementEntry(input: {
  branchInventoryId: number
  orderId?: number | null
  recordedByUserId?: number | null
  movementType: StockMovementType
  quantityChange: number
  transferReference?: string | null
  notes?: string | null
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('stock_movements')
    .insert({
      branch_inventory_id: input.branchInventoryId,
      order_id: input.orderId ?? null,
      recorded_by_user_id: input.recordedByUserId ?? null,
      movement_type: input.movementType,
      quantity_change: input.quantityChange,
      transfer_reference: input.transferReference ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as ErdStockMovement
}

export async function createPurchaseOrderRecord(input: {
  supplierId: number
  branchId: number
  requestedByUserId?: number
  supplierQuoteReference?: string
  notes?: string
  items: { itemId: number; quantityRequested: number; quotedUnitCost: number }[]
}) {
  if (!supabase) return null
  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      supplier_id: input.supplierId,
      branch_id: input.branchId,
      requested_by_user_id: input.requestedByUserId ?? null,
      supplier_quote_reference: input.supplierQuoteReference ?? null,
      purchase_status: 'Pending',
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (poErr) throw poErr

  if (input.items.length > 0) {
    const rows = input.items.map((it) => ({
      purchase_order_id: po.purchase_order_id,
      item_id: it.itemId,
      quantity_requested: it.quantityRequested,
      quoted_unit_cost: it.quotedUnitCost,
    }))
    const { error: itemErr } = await supabase.from('purchase_order_items').insert(rows)
    if (itemErr) throw itemErr
  }

  return po as ErdPurchaseOrder
}

export async function createSupplierReturnEntry(input: {
  deliveryItemId: number
  quantityReturned: number
  reason: string
  refundAmount?: number
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('supplier_returns')
    .insert({
      delivery_item_id: input.deliveryItemId,
      quantity_returned: input.quantityReturned,
      reason: input.reason,
      refund_amount: input.refundAmount ?? 0,
      return_status: 'Requested',
    })
    .select()
    .single()
  if (error) throw error
  return data as ErdSupplierReturn
}

/* ============================================================================
   MODULE 6: ASSESSMENT & DOCUMENTATION + SUPABASE STORAGE BUCKETS
   Tables: shoe_assessments, assessment_photos
   Buckets: before-photos, after-photos
   ============================================================================ */

export async function upsertShoeAssessmentRecord(input: {
  orderId: number
  assessedByUserId?: number | null
  shoeCondition: string
  damageFindings: string
  recommendations: string
  serviceNotes?: string
  assessmentStatus: ErdShoeAssessment['assessment_status']
}) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('shoe_assessments')
    .upsert(
      {
        order_id: input.orderId,
        assessed_by_user_id: input.assessedByUserId ?? null,
        shoe_condition: input.shoeCondition,
        damage_findings: input.damageFindings,
        recommendations: input.recommendations,
        service_notes: input.serviceNotes ?? null,
        assessment_status: input.assessmentStatus,
        assessed_at: new Date().toISOString(),
        finalized_at: input.assessmentStatus === 'Completed' ? new Date().toISOString() : null,
      },
      { onConflict: 'order_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data as ErdShoeAssessment
}

export async function uploadAssessmentPhotoToStorage(input: {
  branchId: number
  orderId: number
  assessmentId: number
  uploadedByUserId?: number | null
  side: 'before' | 'after'
  angle: 'left' | 'right' | 'toe' | 'sole'
  fileOrDataUrl: File | string
  caption?: string
}): Promise<{ filePath: string; record: ErdAssessmentPhoto | null }> {
  const bucket = input.side === 'before' ? 'before-photos' : 'after-photos'
  const filePath = `branch-${input.branchId}/order-${input.orderId}/${input.side}-${input.angle}-${Date.now()}.jpg`
  const photoType = `${input.side.toUpperCase()}_${input.angle.toUpperCase()}` as AssessmentPhotoType

  if (!supabase || !isSupabaseConfigured) {
    return { filePath, record: null }
  }

  let uploadBody: File | Blob
  if (typeof input.fileOrDataUrl === 'string') {
    const res = await fetch(input.fileOrDataUrl)
    uploadBody = await res.blob()
  } else {
    uploadBody = input.fileOrDataUrl
  }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, uploadBody, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('assessment_photos')
    .insert({
      assessment_id: input.assessmentId,
      uploaded_by_user_id: input.uploadedByUserId ?? null,
      photo_type: photoType,
      file_path: filePath,
      caption: input.caption ?? `${input.side.toUpperCase()} - ${input.angle.toUpperCase()}`,
    })
    .select()
    .single()

  if (error) throw error
  return { filePath, record: data as ErdAssessmentPhoto }
}

/* ============================================================================
   MODULE 7: ADMINISTRATION DASHBOARD, AUDIT LOGS & BACKUP
   Tables: audit_logs, system_settings
   ============================================================================ */

export async function fetchAuditLogsList(limit = 100): Promise<ErdAuditLog[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as ErdAuditLog[]
}

export async function updateSystemSettingEntry(
  settingKey: string,
  settingValue: string,
  updatedByUserId?: number
): Promise<ErdSystemSetting | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('system_settings')
    .upsert(
      {
        setting_key: settingKey,
        setting_value: settingValue,
        updated_by_user_id: updatedByUserId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'setting_key' }
    )
    .select()
    .single()
  if (error) throw error
  return data as ErdSystemSetting
}

export async function triggerDatabaseBackupManifest() {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('fn_generate_backup_manifest')
  if (error) throw error
  return data
}

/* ============================================================================
   LIVE PRODUCTION DATA LOADER FROM SUPABASE POSTGRESQL
   Fetches live service_orders, bookings, branch_inventory, user_accounts,
   and audit_logs so dashboards display only real production rows.
   ============================================================================ */

export async function fetchLiveProductionData() {
  if (!supabase || !isSupabaseConfigured) {
    return { orders: [], inventory: [], users: [], auditLogs: [] }
  }

  const stageMap: Record<string, number> = {
    'Pending Assessment': 1,
    'In Progress': 2,
    'Quality Check': 3,
    'Ready for Pickup': 4,
    Completed: 5,
  }

  let liveOrders: any[] = []
  try {
    const { data: soRows } = await supabase
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

    if (Array.isArray(soRows)) {
      liveOrders = soRows.map((row: any) => {
        const bk = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings
        const cp = bk?.customer_profiles
        const ua = Array.isArray(cp?.user_accounts) ? cp?.user_accounts[0] : cp?.user_accounts
        const bs = bk?.branch_services
        const br = bs?.branches
        const ss = bs?.shoe_services
        const sa = Array.isArray(row.shoe_assessments) ? row.shoe_assessments[0] : row.shoe_assessments

        const rawReq = String(bk?.customer_request || row.work_instructions || '')
        const shoeTitle = rawReq.split('—')[0]?.trim() || 'Sneaker Pair'
        const email = ua?.email || ''
        const fullName = cp ? `${cp.first_name || ''} ${cp.last_name || ''}`.trim() : 'Customer'
        const sched = bk?.scheduled_at ? new Date(bk.scheduled_at) : new Date(row.received_at || Date.now())
        const dateStr = sched.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        const timeStr = sched.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const priceNum = Number(bk?.price_at_booking ?? bs?.service_price ?? 650)
        const st = (row.order_status || 'Pending Assessment') as OrderStatus

        return {
          id: String(row.order_number || `WMK-2026-${String(row.order_id).padStart(4, '0')}`),
          customer: fullName || 'Customer',
          email: email || '',
          shoe: shoeTitle,
          service: ss?.service_name || 'Deep Cleaning',
          branch: br?.branch_name || 'Wash My Kicks – Pasig City',
          date: dateStr,
          time: timeStr,
          price: `₱${priceNum.toLocaleString()}`,
          status: st,
          stageIndex: stageMap[st] || 1,
          specialist: 'Assigned Specialist',
          assessed: sa?.assessment_status === 'Completed' || sa?.assessment_status === 'Approved',
          assessmentNotes: sa?.damage_findings || sa?.service_notes || undefined,
        }
      })
    }
  } catch {}

  let liveInventory: any[] = []
  try {
    const { data: invRows } = await supabase
      .from('vw_branch_inventory_stock')
      .select('*')
      .order('branch_inventory_id', { ascending: true })

    if (Array.isArray(invRows)) {
      liveInventory = invRows.map((r: any) => ({
        id: `inv-${r.branch_inventory_id}`,
        name: String(r.item_name || 'Inventory Item'),
        category: (r.category || 'Cleaning Chemicals') as any,
        branch: String(r.branch_name || 'Wash My Kicks – Pasig City'),
        stock: Number(r.current_stock ?? 0),
        target: Math.max(10, Number(r.reorder_level ?? 10) * 2),
      }))
    }
  } catch {}

  let liveUsers: any[] = []
  try {
    const { data: usrRows } = await supabase
      .from('user_accounts')
      .select('user_id, username, email, account_status, roles(role_name), branches(branch_name)')
      .order('user_id', { ascending: true })

    if (Array.isArray(usrRows)) {
      liveUsers = usrRows.map((u: any) => ({
        id: `USR-${String(u.user_id).padStart(2, '0')}`,
        name: String(u.username || u.email || 'User'),
        email: String(u.email || ''),
        role: String(u.roles?.role_name || 'CUSTOMER'),
        branch: String(u.branches?.branch_name || 'All Branches'),
        active: u.account_status === 'ACTIVE',
      }))
    }
  } catch {}

  let liveAudits: ErdAuditLog[] = []
  try {
    liveAudits = await fetchAuditLogsList(50)
  } catch {}

  return {
    orders: liveOrders,
    inventory: liveInventory,
    users: liveUsers,
    auditLogs: liveAudits,
  }
}
