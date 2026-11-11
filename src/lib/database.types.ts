/* ============================================================================
   WASHMYKICKS — COMPLETE TYPESCRIPT ERD SCHEMA DEFINITIONS (26 TABLES + 4 VIEWS)
   Source of Truth: Uploaded WashMyKicks Entity-Relationship Diagram (ERD)
   ============================================================================ */

export type RoleName = 'CUSTOMER' | 'STAFF' | 'ADMINISTRATOR'

export type OrderStatus =
  | 'Pending Assessment'
  | 'In Progress'
  | 'Quality Check'
  | 'Ready for Pickup'
  | 'Completed'

export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Checked In'
  | 'Completed'
  | 'Cancelled'
  | 'Rescheduled'

export type StockMovementType =
  | 'RESTOCK'
  | 'DELIVERY'
  | 'USAGE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT'
  | 'RETURN'

export type AssessmentPhotoType =
  | 'BEFORE'
  | 'AFTER'
  | 'BEFORE_LEFT'
  | 'BEFORE_RIGHT'
  | 'BEFORE_TOE'
  | 'BEFORE_SOLE'
  | 'AFTER_LEFT'
  | 'AFTER_RIGHT'
  | 'AFTER_TOE'
  | 'AFTER_SOLE'

export type NotificationType =
  | 'BOOKING_CONFIRMATION'
  | 'BOOKING_UPDATE'
  | 'ORDER_STATUS_UPDATE'
  | 'READY_FOR_PICKUP'
  | 'ORDER_COMPLETED'
  | 'ASSESSMENT_UPDATE'
  | 'SYSTEM_ALERT'

/* ==================== 1. CUSTOMER MANAGEMENT ==================== */

export interface ErdRole {
  role_id: number
  role_name: RoleName
  description: string | null
}

export interface ErdUserAccount {
  user_id: number
  auth_uid?: string | null
  role_id: number
  branch_id: number | null
  username: string
  email: string
  password_hash: string
  account_status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'LOCKED' | 'INACTIVE'
  email_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface ErdCustomerProfile {
  customer_id: number
  user_id: number
  first_name: string
  last_name: string
  phone: string | null
  address: string | null
  created_at: string
}

/* ==================== 2. SHOE BOOKING MANAGEMENT ==================== */

export interface ErdBranch {
  branch_id: number
  branch_code: string
  branch_name: string
  address: string | null
  contact_number: string | null
  email: string | null
  is_active: boolean
}

export interface ErdBranchHour {
  branch_hour_id: number
  branch_id: number
  day_of_week: number // 0 (Sun) - 6 (Sat)
  opening_time: string | null
  closing_time: string | null
  is_closed: boolean
}

export interface ErdShoeService {
  service_id: number
  service_name: string
  description: string | null
  is_active: boolean
}

export interface ErdBranchService {
  branch_service_id: number
  branch_id: number
  service_id: number
  service_price: number
  estimated_duration_minutes: number
  is_available: boolean
}

export interface ErdBooking {
  booking_id: number
  customer_id: number
  branch_service_id: number
  scheduled_at: string
  price_at_booking: number
  booking_status: BookingStatus
  customer_request: string | null
  created_at: string
  updated_at: string
}

/* ==================== 3. CUSTOMER RELATIONSHIP MANAGEMENT ==================== */

export interface ErdCrmInteraction {
  interaction_id: number
  customer_id: number
  handled_by_user_id: number | null
  interaction_type: 'REVIEW' | 'INQUIRY' | 'COMPLAINT' | 'FOLLOW_UP' | 'FEEDBACK'
  customer_message: string | null
  staff_response: string | null
  rating: number | null
  interaction_status: 'Open' | 'In Review' | 'Responded' | 'Published' | 'Closed'
  interaction_at: string
  responded_at: string | null
}

export interface ErdNotification {
  notification_id: number
  customer_id: number
  notification_type: NotificationType
  message: string
  delivery_status: 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Failed'
  created_at: string
  sent_at: string | null
  read_at: string | null
}

export interface ErdNotificationContext {
  notification_id: number
  booking_id: number | null
  order_id: number | null
}

export interface ErdCustomerNotificationPreference {
  preference_id: number
  customer_id: number
  preference_type: string
  is_enabled: boolean
}

/* ==================== 4. ORDER MANAGEMENT ==================== */

export interface ErdServiceOrder {
  order_id: number
  booking_id: number
  order_number: string
  received_by_user_id: number | null
  assigned_to_user_id: number | null
  received_at: string | null
  assigned_at: string | null
  assignment_accepted_at: string | null
  assignment_status: 'Unassigned' | 'Assigned' | 'Accepted' | 'In Work' | 'Completed'
  due_at: string | null
  order_status: OrderStatus
  work_instructions: string | null
  progress_notes: string | null
  completed_at: string | null
}

/* ==================== 5. INVENTORY MANAGEMENT ==================== */

export interface ErdSupplier {
  supplier_id: number
  supplier_name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  supplier_status: 'Active' | 'Inactive' | 'Suspended'
}

export interface ErdInventoryItem {
  item_id: number
  item_code: string
  item_name: string
  category: string
  unit_of_measure: string
  description: string | null
  is_active: boolean
}

export interface ErdPurchaseOrder {
  purchase_order_id: number
  supplier_id: number
  branch_id: number
  requested_by_user_id: number | null
  approved_by_user_id: number | null
  supplier_quote_reference: string | null
  order_date: string
  purchase_status: 'Draft' | 'Pending' | 'Approved' | 'Ordered' | 'Partially Received' | 'Received' | 'Cancelled'
  notes: string | null
  approved_at: string | null
}

export interface ErdPurchaseOrderItem {
  purchase_order_item_id: number
  purchase_order_id: number
  item_id: number
  quantity_requested: number
  quoted_unit_cost: number
}

export interface ErdDelivery {
  delivery_id: number
  purchase_order_id: number
  received_by_user_id: number | null
  delivery_date: string
  proof_of_delivery_path: string | null
  delivery_status: 'Pending' | 'Partial' | 'Received' | 'Inspecting' | 'Rejected'
  delivery_notes: string | null
}

export interface ErdDeliveryItem {
  delivery_item_id: number
  delivery_id: number
  purchase_order_item_id: number
  quantity_received: number
}

export interface ErdBranchInventory {
  branch_inventory_id: number
  branch_id: number
  item_id: number
  reorder_level: number
  updated_at: string
}

export interface ErdStockMovement {
  movement_id: number
  branch_inventory_id: number
  order_id: number | null
  recorded_by_user_id: number | null
  movement_type: StockMovementType
  quantity_change: number
  transfer_reference: string | null
  movement_date: string
  notes: string | null
}

export interface ErdSupplierReturn {
  supplier_return_id: number
  delivery_item_id: number
  quantity_returned: number
  reason: string | null
  supplier_response: string | null
  refund_amount: number
  return_status: 'Requested' | 'Approved' | 'Replaced' | 'Refunded' | 'Rejected'
  requested_at: string
  resolved_at: string | null
}

/* ==================== 6. ASSESSMENT & DOCUMENTATION ==================== */

export interface ErdShoeAssessment {
  assessment_id: number
  order_id: number
  assessed_by_user_id: number | null
  shoe_condition: string | null
  damage_findings: string | null
  recommendations: string | null
  service_notes: string | null
  assessment_status: 'Pending' | 'Draft' | 'Completed' | 'Approved'
  assessed_at: string | null
  finalized_at: string | null
}

export interface ErdAssessmentPhoto {
  photo_id: number
  assessment_id: number
  uploaded_by_user_id: number | null
  photo_type: AssessmentPhotoType
  file_path: string
  caption: string | null
  uploaded_at: string
}

/* ==================== 7. ADMINISTRATION DASHBOARD ==================== */

export interface ErdAuditLog {
  audit_id: number
  user_id: number | null
  module_name: string
  action_type: string
  target_entity: string
  target_record_id: number | null
  details: string | null
  created_at: string
}

export interface ErdSystemSetting {
  setting_id: number
  setting_key: string
  setting_value: string | null
  updated_by_user_id: number | null
  updated_at: string
}

/* ==================== ANALYTICAL VIEW TYPES ==================== */

export interface ViewBranchInventoryStock {
  branch_inventory_id: number
  branch_id: number
  branch_code: string
  branch_name: string
  item_id: number
  item_code: string
  item_name: string
  category: string
  unit_of_measure: string
  reorder_level: number
  current_stock: number
  stock_health_status: 'Healthy' | 'Low' | 'Critical' | 'Out of Stock'
  updated_at: string
}

export interface ViewOrderTrackingDetails {
  order_id: number
  order_number: string
  order_status: OrderStatus
  assignment_status: string
  received_at: string | null
  assigned_at: string | null
  due_at: string | null
  completed_at: string | null
  work_instructions: string | null
  progress_notes: string | null
  booking_id: number
  scheduled_at: string
  price_at_booking: number
  booking_status: BookingStatus
  customer_request: string | null
  customer_id: number
  customer_user_id: number
  customer_full_name: string
  customer_email: string
  customer_phone: string | null
  branch_id: number
  branch_code: string
  branch_name: string
  service_id: number
  service_name: string
  assigned_to_user_id: number | null
  assigned_specialist_username: string
  assessment_id: number | null
  shoe_condition: string | null
  damage_findings: string | null
  recommendations: string | null
  assessment_notes: string | null
  assessment_status: string | null
}
