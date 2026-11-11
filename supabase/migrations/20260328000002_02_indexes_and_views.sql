-- ============================================================================
-- WASHMYKICKS — MIGRATION 02: PERFORMANCE INDEXES & REPORTING VIEWS
-- Optimizes search, filtering, reporting, and multi-branch dashboard queries
-- ============================================================================

-- 1. BOOKINGS INDEXES
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_branch_service_id ON public.bookings(branch_service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_at ON public.bookings(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status_scheduled ON public.bookings(booking_status, scheduled_at DESC);

-- 2. SERVICE_ORDERS INDEXES
CREATE INDEX IF NOT EXISTS idx_service_orders_order_number ON public.service_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_booking_id ON public.service_orders(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_assigned_to ON public.service_orders(assigned_to_user_id, order_status);
CREATE INDEX IF NOT EXISTS idx_service_orders_received_by ON public.service_orders(received_by_user_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status_due ON public.service_orders(order_status, due_at);

-- 3. NOTIFICATIONS & CONTEXT INDEXES
CREATE INDEX IF NOT EXISTS idx_notifications_customer_created ON public.notifications(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(customer_id, delivery_status) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_contexts_order ON public.notification_contexts(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_contexts_booking ON public.notification_contexts(booking_id);

-- 4. INVENTORY_ITEMS & BRANCH_INVENTORY INDEXES
CREATE INDEX IF NOT EXISTS idx_inventory_items_code ON public.inventory_items(item_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name_search ON public.inventory_items(LOWER(item_name));
CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch_item ON public.branch_inventory(branch_id, item_id);

-- 5. STOCK_MOVEMENTS & PROCUREMENT INDEXES
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_inv_date ON public.stock_movements(branch_inventory_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON public.stock_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type_date ON public.stock_movements(movement_type, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch_status ON public.purchase_orders(branch_id, purchase_status);
CREATE INDEX IF NOT EXISTS idx_deliveries_po_date ON public.deliveries(purchase_order_id, delivery_date DESC);

-- 6. CRM_INTERACTIONS INDEXES
CREATE INDEX IF NOT EXISTS idx_crm_interactions_customer_date ON public.crm_interactions(customer_id, interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_type_status ON public.crm_interactions(interaction_type, interaction_status);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_handled_by ON public.crm_interactions(handled_by_user_id);

-- 7. USER_ACCOUNTS, ASSESSMENTS & AUDIT_LOGS INDEXES
CREATE INDEX IF NOT EXISTS idx_user_accounts_role_branch ON public.user_accounts(role_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_auth_uid ON public.user_accounts(auth_uid);
CREATE INDEX IF NOT EXISTS idx_shoe_assessments_order ON public.shoe_assessments(order_id, assessment_status);
CREATE INDEX IF NOT EXISTS idx_assessment_photos_assessment ON public.assessment_photos(assessment_id, photo_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_module ON public.audit_logs(created_at DESC, module_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_login_attempts_email_time ON public.security_login_attempts(email, attempted_at DESC);

-- ============================================================================
-- ANALYTICAL & DASHBOARD VIEWS
-- ============================================================================

-- VIEW 1: Live Branch Inventory Stock Balance (computed from STOCK_MOVEMENTS)
CREATE OR REPLACE VIEW public.v_branch_inventory_stock AS
SELECT
  bi.branch_inventory_id,
  bi.branch_id,
  b.branch_code,
  b.branch_name,
  bi.item_id,
  ii.item_code,
  ii.item_name,
  ii.category,
  ii.unit_of_measure,
  bi.reorder_level,
  COALESCE(SUM(sm.quantity_change), 0)::DECIMAL(12,2) AS current_stock,
  CASE
    WHEN COALESCE(SUM(sm.quantity_change), 0) <= 0 THEN 'Out of Stock'
    WHEN COALESCE(SUM(sm.quantity_change), 0) <= (bi.reorder_level * 0.5) THEN 'Critical'
    WHEN COALESCE(SUM(sm.quantity_change), 0) <= bi.reorder_level THEN 'Low'
    ELSE 'Healthy'
  END AS stock_health_status,
  bi.updated_at
FROM public.branch_inventory bi
JOIN public.branches b ON b.branch_id = bi.branch_id
JOIN public.inventory_items ii ON ii.item_id = bi.item_id
LEFT JOIN public.stock_movements sm ON sm.branch_inventory_id = bi.branch_inventory_id
WHERE ii.is_active = TRUE
GROUP BY
  bi.branch_inventory_id,
  bi.branch_id,
  b.branch_code,
  b.branch_name,
  bi.item_id,
  ii.item_code,
  ii.item_name,
  ii.category,
  ii.unit_of_measure,
  bi.reorder_level,
  bi.updated_at;

-- VIEW 2: Low-Stock Alerts View for Staff & Admin Dashboards
CREATE OR REPLACE VIEW public.v_low_stock_alerts AS
SELECT *
FROM public.v_branch_inventory_stock
WHERE stock_health_status IN ('Low', 'Critical', 'Out of Stock')
ORDER BY current_stock ASC;

-- VIEW 3: Complete Order Tracking & Workflow View
CREATE OR REPLACE VIEW public.v_order_tracking_details AS
SELECT
  so.order_id,
  so.order_number,
  so.order_status,
  so.assignment_status,
  so.received_at,
  so.assigned_at,
  so.due_at,
  so.completed_at,
  so.work_instructions,
  so.progress_notes,
  bk.booking_id,
  bk.scheduled_at,
  bk.price_at_booking,
  bk.booking_status,
  bk.customer_request,
  cp.customer_id,
  cp.user_id AS customer_user_id,
  (cp.first_name || ' ' || cp.last_name) AS customer_full_name,
  ua_cust.email AS customer_email,
  cp.phone AS customer_phone,
  br.branch_id,
  br.branch_code,
  br.branch_name,
  ss.service_id,
  ss.service_name,
  so.assigned_to_user_id,
  COALESCE(ua_staff.username, 'Unassigned') AS assigned_specialist_username,
  sa.assessment_id,
  sa.shoe_condition,
  sa.damage_findings,
  sa.recommendations,
  sa.service_notes AS assessment_notes,
  sa.assessment_status
FROM public.service_orders so
JOIN public.bookings bk ON bk.booking_id = so.booking_id
JOIN public.customer_profiles cp ON cp.customer_id = bk.customer_id
JOIN public.user_accounts ua_cust ON ua_cust.user_id = cp.user_id
JOIN public.branch_services bs ON bs.branch_service_id = bk.branch_service_id
JOIN public.branches br ON br.branch_id = bs.branch_id
JOIN public.shoe_services ss ON ss.service_id = bs.service_id
LEFT JOIN public.user_accounts ua_staff ON ua_staff.user_id = so.assigned_to_user_id
LEFT JOIN public.shoe_assessments sa ON sa.order_id = so.order_id;

-- VIEW 4: Branch Performance & Revenue Summary for Admin Dashboard
CREATE OR REPLACE VIEW public.v_branch_performance_summary AS
SELECT
  br.branch_id,
  br.branch_code,
  br.branch_name,
  COUNT(DISTINCT so.order_id) AS total_orders,
  COUNT(DISTINCT so.order_id) FILTER (WHERE so.order_status = 'Pending Assessment') AS pending_assessment_count,
  COUNT(DISTINCT so.order_id) FILTER (WHERE so.order_status = 'In Progress') AS in_progress_count,
  COUNT(DISTINCT so.order_id) FILTER (WHERE so.order_status = 'Quality Check') AS quality_check_count,
  COUNT(DISTINCT so.order_id) FILTER (WHERE so.order_status = 'Ready for Pickup') AS ready_for_pickup_count,
  COUNT(DISTINCT so.order_id) FILTER (WHERE so.order_status = 'Completed') AS completed_count,
  COALESCE(SUM(bk.price_at_booking) FILTER (WHERE so.order_status IN ('Ready for Pickup', 'Completed')), 0)::DECIMAL(12,2) AS realized_revenue,
  COALESCE(SUM(bk.price_at_booking), 0)::DECIMAL(12,2) AS gross_booked_revenue
FROM public.branches br
LEFT JOIN public.branch_services bs ON bs.branch_id = br.branch_id
LEFT JOIN public.bookings bk ON bk.branch_service_id = bs.branch_service_id
LEFT JOIN public.service_orders so ON so.booking_id = bk.booking_id
GROUP BY br.branch_id, br.branch_code, br.branch_name;
