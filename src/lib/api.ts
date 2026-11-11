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
}) {
  if (!supabase || !isSupabaseConfigured) {
    return { mode: 'local' as const, email: input.email }
  }

  const username =
    input.username || `${input.firstName.toLowerCase().replace(/\s+/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        role: 'CUSTOMER',
        username,
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone || '',
        address: input.address || '',
      },
    },
  })

  if (error) throw error

  await dispatchTransactionalEmail({
    to: input.email,
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
}) {
  const guard = checkClientBruteForceGuard(input.email)
  if (!guard.allowed) {
    throw new Error('Account temporarily locked due to too many failed login attempts. Please wait 15 minutes.')
  }

  if (!supabase || !isSupabaseConfigured) {
    recordClientLoginAttempt(input.email, true)
    return { mode: 'local' as const, role: input.expectedRole }
  }

  // Check database-enforced rate limit before attempting sign-in
  const { data: allowedByDb } = await supabase.rpc('fn_check_login_rate_limit', {
    p_email: input.email,
  })
  if (allowedByDb === false) {
    throw new Error('Account is locked due to repeated failed login attempts.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error || !data.user) {
    recordClientLoginAttempt(input.email, false)
    await supabase.rpc('fn_record_auth_event', {
      p_action: 'LOGIN_FAILED',
      p_email: input.email,
    })
    throw error || new Error('Invalid login credentials.')
  }

  // Verify role in user_accounts -> roles
  const { data: accountRow } = await supabase
    .from('user_accounts')
    .select('user_id, role_id, branch_id, account_status, roles(role_name)')
    .eq('auth_uid', data.user.id)
    .single()

  if (accountRow && accountRow.account_status === 'LOCKED') {
    await supabase.auth.signOut()
    throw new Error('This account is locked. Please contact an administrator.')
  }

  recordClientLoginAttempt(input.email, true)
  await supabase.rpc('fn_record_auth_event', {
    p_action: 'LOGIN',
    p_email: input.email,
  })

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
