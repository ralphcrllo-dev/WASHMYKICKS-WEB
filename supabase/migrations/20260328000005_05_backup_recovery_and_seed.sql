-- ============================================================================
-- WASHMYKICKS — MIGRATION 05: BACKUP, RECOVERY, LOGGING & MULTI-BRANCH SEED
-- ============================================================================

-- ============================================================================
-- 1. ERROR LOGGING, TRANSACTION LOGGING & DAILY BACKUP SNAPSHOT FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_log_transaction_error(
  p_module_name VARCHAR,
  p_target_entity VARCHAR,
  p_error_details TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    module_name,
    action_type,
    target_entity,
    details,
    created_at
  )
  VALUES (
    public.fn_current_user_id(),
    p_module_name,
    'TRANSACTION_ERROR',
    p_target_entity,
    p_error_details,
    NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_generate_backup_manifest()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manifest JSONB;
BEGIN
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'system', 'WashMyKicks Enterprise Multi-Branch System',
    'table_counts', jsonb_build_object(
      'roles', (SELECT COUNT(*) FROM public.roles),
      'user_accounts', (SELECT COUNT(*) FROM public.user_accounts),
      'customer_profiles', (SELECT COUNT(*) FROM public.customer_profiles),
      'branches', (SELECT COUNT(*) FROM public.branches),
      'branch_hours', (SELECT COUNT(*) FROM public.branch_hours),
      'shoe_services', (SELECT COUNT(*) FROM public.shoe_services),
      'branch_services', (SELECT COUNT(*) FROM public.branch_services),
      'bookings', (SELECT COUNT(*) FROM public.bookings),
      'service_orders', (SELECT COUNT(*) FROM public.service_orders),
      'shoe_assessments', (SELECT COUNT(*) FROM public.shoe_assessments),
      'assessment_photos', (SELECT COUNT(*) FROM public.assessment_photos),
      'crm_interactions', (SELECT COUNT(*) FROM public.crm_interactions),
      'notifications', (SELECT COUNT(*) FROM public.notifications),
      'notification_contexts', (SELECT COUNT(*) FROM public.notification_contexts),
      'customer_notification_preferences', (SELECT COUNT(*) FROM public.customer_notification_preferences),
      'suppliers', (SELECT COUNT(*) FROM public.suppliers),
      'inventory_items', (SELECT COUNT(*) FROM public.inventory_items),
      'purchase_orders', (SELECT COUNT(*) FROM public.purchase_orders),
      'purchase_order_items', (SELECT COUNT(*) FROM public.purchase_order_items),
      'deliveries', (SELECT COUNT(*) FROM public.deliveries),
      'delivery_items', (SELECT COUNT(*) FROM public.delivery_items),
      'branch_inventory', (SELECT COUNT(*) FROM public.branch_inventory),
      'stock_movements', (SELECT COUNT(*) FROM public.stock_movements),
      'supplier_returns', (SELECT COUNT(*) FROM public.supplier_returns),
      'audit_logs', (SELECT COUNT(*) FROM public.audit_logs),
      'system_settings', (SELECT COUNT(*) FROM public.system_settings)
    )
  ) INTO v_manifest;

  INSERT INTO public.audit_logs (
    user_id,
    module_name,
    action_type,
    target_entity,
    details,
    created_at
  )
  VALUES (
    public.fn_current_user_id(),
    'BACKUP_AND_RECOVERY',
    'DAILY_BACKUP_SNAPSHOT',
    'ALL_26_ERD_TABLES',
    v_manifest::TEXT,
    NOW()
  );

  RETURN v_manifest;
END;
$$;

-- ============================================================================
-- 2. SEED DATA: ROLES, 7 BRANCHES, SERVICES, INVENTORY & DEMO ACCOUNTS
-- ============================================================================

-- Roles
INSERT INTO public.roles (role_id, role_name, description)
VALUES
  (1, 'CUSTOMER', 'Customer portal access: bookings, order tracking, notifications, reviews, and profile.'),
  (2, 'STAFF', 'Branch specialist access: assigned job orders, shoe assessments, 4-angle documentation, and branch inventory.'),
  (3, 'ADMINISTRATOR', 'Full multi-branch executive access: branches, inventory, CRM, job orders, reports, audit trail, user management, and settings.')
ON CONFLICT (role_name) DO NOTHING;

-- Branches
INSERT INTO public.branches (branch_id, branch_code, branch_name, address, contact_number, email, is_active)
VALUES
  (1, 'WMK-SJC', 'Wash My Kicks – San Juan City', '300 Col. Bonny Serrano Ave., San Juan City', '+63 917 801 1101', 'sanjuan@washmykicks.com', TRUE),
  (2, 'WMK-QC', 'Wash My Kicks – Quezon City', 'Tomas Morato Ave., Quezon City', '+63 917 801 1102', 'quezoncity@washmykicks.com', TRUE),
  (3, 'WMK-PSG', 'Wash My Kicks – Pasig City', 'Kapitolyo, Pasig City', '+63 917 801 1103', 'pasig@washmykicks.com', TRUE),
  (4, 'WMK-PAT', 'Wash My Kicks – Pateros', '402 G. De Borja St., Brgy. Aguho, Pateros', '+63 917 801 1104', 'pateros@washmykicks.com', TRUE),
  (5, 'WMK-MNT', 'Wash My Kicks – Montalban, Rizal', 'E. Rodriguez Hwy, Montalban, Rizal', '+63 917 801 1105', 'montalban@washmykicks.com', TRUE),
  (6, 'WMK-MRG', 'Wash My Kicks – Morong, Rizal', '2nd Floor A5R Commercial Space Rental, Manila East Road, Morong, Rizal', '+63 917 801 1106', 'morong@washmykicks.com', TRUE),
  (7, 'WMK-BAC', 'Wash My Kicks – Bacoor, Cavite', 'Cerritos Trails Molino 3, Bacoor, Cavite', '+63 917 801 1107', 'bacoor@washmykicks.com', TRUE)
ON CONFLICT (branch_code) DO NOTHING;

-- Branch Hours (Open Daily 10:00 AM - 8:00 PM across all 7 branches)
INSERT INTO public.branch_hours (branch_id, day_of_week, opening_time, closing_time, is_closed)
SELECT b.branch_id, d.dow, '10:00'::TIME, '20:00'::TIME, FALSE
FROM public.branches b
CROSS JOIN (VALUES (0), (1), (2), (3), (4), (5), (6)) AS d(dow)
ON CONFLICT (branch_id, day_of_week) DO NOTHING;

-- Shoe Services
INSERT INTO public.shoe_services (service_id, service_name, description, is_active)
VALUES
  (1, 'Basic Cleaning', 'Exterior clean, midsole care, and freshening (2–3 days).', TRUE),
  (2, 'Deep Cleaning', 'Full upper, sole, insole, and lace deep clean (3–5 days).', TRUE),
  (3, 'Restoration', 'Color revival, de-yellowing, and repainting (7–14 days).', TRUE),
  (4, 'Shoe Repair', 'Sole reglue, stitching, and structural damage repair (5–10 days).', TRUE),
  (5, 'Shoe Protection', 'Water and stain-repellent premium coating (1 day).', TRUE)
ON CONFLICT (service_name) DO NOTHING;

-- Branch Services (Map all 5 services across all 7 branches)
INSERT INTO public.branch_services (branch_id, service_id, service_price, estimated_duration_minutes, is_available)
SELECT
  b.branch_id,
  s.service_id,
  CASE s.service_id
    WHEN 1 THEN 350.00
    WHEN 2 THEN 650.00
    WHEN 3 THEN 1200.00
    WHEN 4 THEN 800.00
    WHEN 5 THEN 280.00
  END,
  CASE s.service_id
    WHEN 1 THEN 2880
    WHEN 2 THEN 4320
    WHEN 3 THEN 10080
    WHEN 4 THEN 7200
    WHEN 5 THEN 1440
  END,
  TRUE
FROM public.branches b
CROSS JOIN public.shoe_services s
ON CONFLICT (branch_id, service_id) DO NOTHING;

-- Suppliers
INSERT INTO public.suppliers (supplier_id, supplier_name, contact_person, phone, email, address, supplier_status)
VALUES
  (1, 'Angelus Direct PH Distributors', 'Miguel Villanueva', '+63 917 555 0191', 'orders@angelusph.com', 'Makati City, Metro Manila', 'Active'),
  (2, 'SneakerLab Care & Packaging Co.', 'Hannah Lim', '+63 917 555 0192', 'supply@sneakerlabph.com', 'Pasig City, Metro Manila', 'Active')
ON CONFLICT (supplier_id) DO NOTHING;

-- Inventory Items
INSERT INTO public.inventory_items (item_id, item_code, item_name, category, unit_of_measure, description, is_active)
VALUES
  (1, 'WMK-SKU-001', 'Premium Cleaner 1L', 'Cleaning Chemicals', 'units', 'Concentrated pH-balanced sneaker cleaning solution.', TRUE),
  (2, 'WMK-SKU-002', 'Water Repellent 250ml', 'Shoe Protectors', 'units', 'Hydrophobic stain and water shield spray.', TRUE),
  (3, 'WMK-SKU-003', 'Soft Bristle Brush', 'Brushes', 'units', 'Hog-bristle upper brush for delicate mesh and suede.', TRUE),
  (4, 'WMK-SKU-004', 'WMK Shoe Box', 'Packaging Materials', 'units', 'Reinforced WashMyKicks release box with silica pack.', TRUE),
  (5, 'WMK-SKU-005', 'Angelus White Paint', 'Restoration Supplies', 'units', 'Acrylic leather paint for midsole and upper restoration.', TRUE),
  (6, 'WMK-SKU-006', 'De-Yellowing UV Sole Sauce', 'Restoration Supplies', 'units', 'Oxidation reversal cream for icy and rubber soles.', TRUE),
  (7, 'WMK-SKU-007', 'Microfiber Towel Pack', 'Brushes', 'units', 'Lint-free microfiber finishing towels.', TRUE)
ON CONFLICT (item_code) DO NOTHING;

-- System Settings
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES
  ('SYSTEM_NAME', 'WashMyKicks Sneaker Care System'),
  ('SMTP_PROVIDER', 'Gmail SMTP (nodemailer)'),
  ('MAX_LOGIN_ATTEMPTS', '5'),
  ('LOCKOUT_WINDOW_MINUTES', '15'),
  ('DAILY_BACKUP_CRON', '0 2 * * *'),
  ('STORAGE_BEFORE_BUCKET', 'before-photos'),
  ('STORAGE_AFTER_BUCKET', 'after-photos')
ON CONFLICT (setting_key) DO NOTHING;

-- Demo User Accounts (Customer, Staff, Administrator)
INSERT INTO public.user_accounts (user_id, role_id, branch_id, username, email, password_hash, account_status, email_verified_at)
VALUES
  (1, 1, 1, 'juan_delacruz', 'customer@washmykicks.ph', 'SUPABASE_AUTH_MANAGED', 'ACTIVE', NOW()),
  (2, 2, 1, 'carlo_mendoza', 'staff@washmykicks.ph', 'SUPABASE_AUTH_MANAGED', 'ACTIVE', NOW()),
  (3, 3, 1, 'mika_cruz', 'admin@washmykicks.ph', 'SUPABASE_AUTH_MANAGED', 'ACTIVE', NOW())
ON CONFLICT (email) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.user_accounts', 'user_id'), COALESCE((SELECT MAX(user_id) FROM public.user_accounts), 3), true);

-- Demo Customer Profile (customer_id = 1 for immediate booking & CRM testing)
INSERT INTO public.customer_profiles (customer_id, user_id, first_name, last_name, phone, address)
VALUES
  (1, 1, 'Juan', 'Dela Cruz', '+63 917 555 0142', 'San Juan City, Metro Manila')
ON CONFLICT (user_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.customer_profiles', 'customer_id'), COALESCE((SELECT MAX(customer_id) FROM public.customer_profiles), 1), true);

-- Initial Branch Inventory Across Branches
INSERT INTO public.branch_inventory (branch_id, item_id, current_quantity, reorder_level, updated_at)
SELECT b.branch_id, i.item_id, 25.00, 10.00, NOW()
FROM public.branches b
CROSS JOIN public.inventory_items i
ON CONFLICT (branch_id, item_id) DO NOTHING;

-- Initial Booking & Service Order (triggers automatic service_order + notification creation)
INSERT INTO public.bookings (booking_id, customer_id, branch_service_id, scheduled_at, price_at_booking, booking_status, customer_request)
SELECT 1, 1, bs.branch_service_id, NOW() + INTERVAL '1 day', 650.00, 'Confirmed', 'Air Jordan 1 Retro High OG Chicago — Deep Cleaning'
FROM public.branch_services bs
WHERE bs.branch_id = 1 AND bs.service_id = 2
LIMIT 1
ON CONFLICT (booking_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.bookings', 'booking_id'), COALESCE((SELECT MAX(booking_id) FROM public.bookings), 1), true);

-- Allow publishable client testing across operational tables alongside role-based policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_accounts', 'customer_profiles', 'bookings', 'service_orders',
    'shoe_assessments', 'assessment_photos', 'crm_interactions',
    'notifications', 'notification_contexts', 'customer_notification_preferences',
    'suppliers', 'inventory_items', 'purchase_orders', 'purchase_order_items',
    'deliveries', 'delivery_items', 'branch_inventory', 'stock_movements',
    'supplier_returns', 'audit_logs', 'system_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "wmk_publishable_client_%I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "wmk_publishable_client_%I" ON public.%I FOR ALL USING (TRUE) WITH CHECK (TRUE);', t, t);
  END LOOP;
END $$;
