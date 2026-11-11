-- ============================================================================
-- WASHMYKICKS — MIGRATION 03: SECURITY, WORKFLOW, NOTIFICATION & AUDIT TRIGGERS
-- ============================================================================

-- ============================================================================
-- 1. RBAC & IDENTITY SECURITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_current_user_id()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ua.user_id
  FROM public.user_accounts ua
  WHERE ua.auth_uid = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_current_role_name()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.role_name
  FROM public.user_accounts ua
  JOIN public.roles r ON r.role_id = ua.role_id
  WHERE ua.auth_uid = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_current_branch_id()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ua.branch_id
  FROM public.user_accounts ua
  WHERE ua.auth_uid = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_current_customer_id()
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.customer_id
  FROM public.customer_profiles cp
  JOIN public.user_accounts ua ON ua.user_id = cp.user_id
  WHERE ua.auth_uid = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.fn_current_role_name() = 'ADMINISTRATOR', FALSE);
$$;

CREATE OR REPLACE FUNCTION public.fn_is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.fn_current_role_name() = 'STAFF', FALSE);
$$;

CREATE OR REPLACE FUNCTION public.fn_is_customer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.fn_current_role_name() = 'CUSTOMER', FALSE);
$$;

-- ============================================================================
-- 2. PASSWORD SECURITY & BRUTE-FORCE RATE LIMITING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_hash_password(p_plain_password TEXT)
RETURNS VARCHAR
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT crypt(p_plain_password, gen_salt('bf', 10))::VARCHAR(255);
$$;

CREATE OR REPLACE FUNCTION public.fn_check_login_rate_limit(
  p_email VARCHAR,
  p_ip VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_count INT;
  v_user_id INT;
BEGIN
  SELECT COUNT(*)
  INTO v_failed_count
  FROM public.security_login_attempts
  WHERE LOWER(email) = LOWER(p_email)
    AND was_successful = FALSE
    AND attempted_at >= (NOW() - INTERVAL '15 minutes');

  IF v_failed_count >= 5 THEN
    SELECT user_id INTO v_user_id
    FROM public.user_accounts
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      UPDATE public.user_accounts
      SET account_status = 'LOCKED', updated_at = NOW()
      WHERE user_id = v_user_id AND account_status <> 'LOCKED';

      INSERT INTO public.audit_logs (user_id, module_name, action_type, target_entity, target_record_id, details)
      VALUES (
        v_user_id,
        'AUTHENTICATION',
        'BRUTE_FORCE_LOCKOUT',
        'user_accounts',
        v_user_id,
        'Account locked after 5 failed login attempts within 15 minutes from IP ' || COALESCE(p_ip, 'unknown')
      );
    END IF;

    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_record_auth_event(
  p_action VARCHAR,
  p_email VARCHAR DEFAULT NULL,
  p_ip VARCHAR DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id INT;
BEGIN
  v_user_id := public.fn_current_user_id();

  IF v_user_id IS NULL AND p_email IS NOT NULL THEN
    SELECT user_id INTO v_user_id
    FROM public.user_accounts
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;
  END IF;

  IF p_action IN ('LOGIN', 'LOGIN_FAILED') AND p_email IS NOT NULL THEN
    INSERT INTO public.security_login_attempts (email, ip_address, was_successful)
    VALUES (p_email, p_ip, p_action = 'LOGIN');
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    module_name,
    action_type,
    target_entity,
    target_record_id,
    details
  )
  VALUES (
    v_user_id,
    'AUTHENTICATION',
    p_action,
    'user_accounts',
    v_user_id,
    'Auth event ' || p_action || ' for ' || COALESCE(p_email, 'session user')
  );
END;
$$;

-- ============================================================================
-- 3. SUPABASE AUTH REGISTRATION SYNC TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_auth_user_to_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name VARCHAR(30);
  v_role_id INT;
  v_user_id INT;
  v_customer_id INT;
  v_first_name VARCHAR(80);
  v_last_name VARCHAR(80);
BEGIN
  v_role_name := UPPER(COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER'));
  SELECT role_id INTO v_role_id FROM public.roles WHERE role_name = v_role_name LIMIT 1;
  IF v_role_id IS NULL THEN
    SELECT role_id INTO v_role_id FROM public.roles WHERE role_name = 'CUSTOMER' LIMIT 1;
  END IF;

  INSERT INTO public.user_accounts (
    auth_uid,
    role_id,
    branch_id,
    username,
    email,
    password_hash,
    account_status,
    email_verified_at
  )
  VALUES (
    NEW.id,
    v_role_id,
    NULLIF(NEW.raw_user_meta_data->>'branch_id', '')::INT,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTR(NEW.id::TEXT, 1, 6)
    ),
    NEW.email,
    COALESCE(NEW.encrypted_password, 'SUPABASE_MANAGED_AUTH'),
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'ACTIVE' ELSE 'PENDING_VERIFICATION' END,
    NEW.email_confirmed_at
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_uid = EXCLUDED.auth_uid,
        email_verified_at = COALESCE(EXCLUDED.email_verified_at, public.user_accounts.email_verified_at),
        updated_at = NOW()
  RETURNING user_id INTO v_user_id;

  IF v_role_name = 'CUSTOMER' THEN
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'Valued');
    v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Customer');

    INSERT INTO public.customer_profiles (user_id, first_name, last_name, phone, address)
    VALUES (
      v_user_id,
      v_first_name,
      v_last_name,
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'address'
    )
    ON CONFLICT (user_id) DO NOTHING
    RETURNING customer_id INTO v_customer_id;

    IF v_customer_id IS NOT NULL THEN
      INSERT INTO public.customer_notification_preferences (customer_id, preference_type, is_enabled)
      VALUES
        (v_customer_id, 'EMAIL_BOOKING', TRUE),
        (v_customer_id, 'EMAIL_ORDER_STATUS', TRUE),
        (v_customer_id, 'EMAIL_PICKUP', TRUE),
        (v_customer_id, 'IN_APP', TRUE)
      ON CONFLICT (customer_id, preference_type) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. NOTIFICATION HELPER FUNCTION (NOTIFICATIONS + NOTIFICATION_CONTEXTS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_queue_customer_notification(
  p_customer_id INT,
  p_notification_type VARCHAR,
  p_message TEXT,
  p_booking_id INT DEFAULT NULL,
  p_order_id INT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id INT;
BEGIN
  INSERT INTO public.notifications (
    customer_id,
    notification_type,
    message,
    delivery_status,
    created_at
  )
  VALUES (
    p_customer_id,
    p_notification_type,
    p_message,
    'Pending',
    NOW()
  )
  RETURNING notification_id INTO v_notification_id;

  INSERT INTO public.notification_contexts (
    notification_id,
    booking_id,
    order_id
  )
  VALUES (
    v_notification_id,
    p_booking_id,
    p_order_id
  );

  RETURN v_notification_id;
END;
$$;

-- ============================================================================
-- 5. BOOKING VALIDATION & AUTOMATIC JOB ORDER GENERATION TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_validate_and_timestamp_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id INT;
  v_is_available BOOLEAN;
  v_dow SMALLINT;
  v_is_closed BOOLEAN;
BEGIN
  SELECT bs.branch_id, bs.is_available
  INTO v_branch_id, v_is_available
  FROM public.branch_services bs
  WHERE bs.branch_service_id = NEW.branch_service_id;

  IF NOT COALESCE(v_is_available, FALSE) THEN
    RAISE EXCEPTION 'Selected service is not currently available at this branch.';
  END IF;

  v_dow := EXTRACT(DOW FROM NEW.scheduled_at)::SMALLINT;
  SELECT bh.is_closed
  INTO v_is_closed
  FROM public.branch_hours bh
  WHERE bh.branch_id = v_branch_id AND bh.day_of_week = v_dow
  LIMIT 1;

  IF COALESCE(v_is_closed, FALSE) THEN
    RAISE EXCEPTION 'Selected branch is closed on the requested day.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_validate ON public.bookings;
CREATE TRIGGER trg_bookings_validate
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_and_timestamp_booking();

CREATE OR REPLACE FUNCTION public.fn_after_booking_create_order_and_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id INT;
  v_order_number VARCHAR(40);
  v_duration_mins INT;
BEGIN
  v_order_number := 'WMK-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEW.booking_id::TEXT, 4, '0');

  SELECT estimated_duration_minutes
  INTO v_duration_mins
  FROM public.branch_services
  WHERE branch_service_id = NEW.branch_service_id;

  INSERT INTO public.service_orders (
    booking_id,
    order_number,
    received_at,
    assignment_status,
    due_at,
    order_status,
    work_instructions
  )
  VALUES (
    NEW.booking_id,
    v_order_number,
    NOW(),
    'Assigned',
    NEW.scheduled_at + (COALESCE(v_duration_mins, 4320) || ' minutes')::INTERVAL,
    'Pending Assessment',
    NEW.customer_request
  )
  ON CONFLICT (booking_id) DO NOTHING
  RETURNING order_id INTO v_order_id;

  IF v_order_id IS NOT NULL THEN
    INSERT INTO public.shoe_assessments (
      order_id,
      assessment_status,
      assessed_at
    )
    VALUES (
      v_order_id,
      'Pending',
      NOW()
    )
    ON CONFLICT (order_id) DO NOTHING;

    PERFORM public.fn_queue_customer_notification(
      NEW.customer_id,
      'BOOKING_CONFIRMATION',
      'Your appointment has been confirmed. Job Order ' || v_order_number || ' is scheduled for ' || TO_CHAR(NEW.scheduled_at, 'Mon DD, YYYY HH12:MI AM') || '.',
      NEW.booking_id,
      v_order_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_after_insert ON public.bookings;
CREATE TRIGGER trg_bookings_after_insert
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.fn_after_booking_create_order_and_notify();

-- ============================================================================
-- 6. SERVICE ORDER WORKFLOW & NOTIFICATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_handle_service_order_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id INT;
  v_notif_type VARCHAR(30);
  v_message TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    IF NEW.order_status = 'Completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
      NEW.assignment_status := 'Completed';
    END IF;

    SELECT bk.customer_id INTO v_customer_id
    FROM public.bookings bk
    WHERE bk.booking_id = NEW.booking_id;

    IF v_customer_id IS NOT NULL THEN
      v_notif_type := CASE
        WHEN NEW.order_status = 'Ready for Pickup' THEN 'READY_FOR_PICKUP'
        WHEN NEW.order_status = 'Completed' THEN 'ORDER_COMPLETED'
        ELSE 'ORDER_STATUS_UPDATE'
      END;

      v_message := CASE
        WHEN NEW.order_status = 'Ready for Pickup' THEN
          'Job Order ' || NEW.order_number || ' passed Quality Check and is Ready for Pickup!'
        WHEN NEW.order_status = 'Completed' THEN
          'Job Order ' || NEW.order_number || ' has been marked Completed. Thank you for trusting WashMyKicks!'
        ELSE
          'Job Order ' || NEW.order_number || ' status updated to "' || NEW.order_status || '".'
      END;

      PERFORM public.fn_queue_customer_notification(
        v_customer_id,
        v_notif_type,
        v_message,
        NEW.booking_id,
        NEW.order_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_orders_workflow ON public.service_orders;
CREATE TRIGGER trg_service_orders_workflow
BEFORE UPDATE ON public.service_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_service_order_workflow();

-- ============================================================================
-- 7. INVENTORY DELIVERY & STOCK MOVEMENT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_delivery_item_to_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id INT;
  v_item_id INT;
  v_received_by INT;
  v_branch_inv_id INT;
BEGIN
  SELECT po.branch_id, poi.item_id, d.received_by_user_id
  INTO v_branch_id, v_item_id, v_received_by
  FROM public.delivery_items di
  JOIN public.deliveries d ON d.delivery_id = NEW.delivery_id
  JOIN public.purchase_order_items poi ON poi.purchase_order_item_id = NEW.purchase_order_item_id
  JOIN public.purchase_orders po ON po.purchase_order_id = d.purchase_order_id
  WHERE di.delivery_item_id = NEW.delivery_item_id
  LIMIT 1;

  IF v_branch_id IS NOT NULL AND v_item_id IS NOT NULL AND NEW.quantity_received > 0 THEN
    INSERT INTO public.branch_inventory (branch_id, item_id, reorder_level, updated_at)
    VALUES (v_branch_id, v_item_id, 15.00, NOW())
    ON CONFLICT (branch_id, item_id) DO UPDATE
      SET updated_at = NOW()
    RETURNING branch_inventory_id INTO v_branch_inv_id;

    INSERT INTO public.stock_movements (
      branch_inventory_id,
      recorded_by_user_id,
      movement_type,
      quantity_change,
      transfer_reference,
      movement_date,
      notes
    )
    VALUES (
      v_branch_inv_id,
      v_received_by,
      'DELIVERY',
      NEW.quantity_received,
      'DEL-' || NEW.delivery_id,
      NOW(),
      'Auto-posted from Delivery #' || NEW.delivery_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_items_stock ON public.delivery_items;
CREATE TRIGGER trg_delivery_items_stock
AFTER INSERT ON public.delivery_items
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_delivery_item_to_stock();

CREATE OR REPLACE FUNCTION public.fn_touch_branch_inventory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.branch_inventory
  SET updated_at = NOW()
  WHERE branch_inventory_id = NEW.branch_inventory_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_touch_inv ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_touch_inv
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_branch_inventory_updated_at();

-- ============================================================================
-- 8. ENTERPRISE AUTOMATIC AUDIT LOGGING TRIGGER
-- Automatically logs Order Creation, Booking Creation, Inventory Updates,
-- Assessment Updates, and Administrative Changes into public.audit_logs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_module VARCHAR(60);
  v_record_id INT;
  v_details TEXT;
  v_actor_id INT;
BEGIN
  v_actor_id := public.fn_current_user_id();
  v_module := COALESCE(TG_ARGV[0], 'SYSTEM');

  IF TG_TABLE_NAME = 'bookings' THEN
    v_record_id := COALESCE(NEW.booking_id, OLD.booking_id);
    v_details := 'Booking #' || v_record_id || ' (' || COALESCE(NEW.booking_status, 'Deleted') || ')';
  ELSIF TG_TABLE_NAME = 'service_orders' THEN
    v_record_id := COALESCE(NEW.order_id, OLD.order_id);
    v_details := 'Service Order ' || COALESCE(NEW.order_number, OLD.order_number) || ' status: ' || COALESCE(NEW.order_status, 'Deleted');
  ELSIF TG_TABLE_NAME = 'shoe_assessments' THEN
    v_record_id := COALESCE(NEW.assessment_id, OLD.assessment_id);
    v_details := 'Shoe Assessment #' || v_record_id || ' for Order ID ' || COALESCE(NEW.order_id, OLD.order_id) || ' (' || COALESCE(NEW.assessment_status, '') || ')';
  ELSIF TG_TABLE_NAME = 'assessment_photos' THEN
    v_record_id := COALESCE(NEW.photo_id, OLD.photo_id);
    v_details := 'Assessment Photo (' || COALESCE(NEW.photo_type, '') || ') uploaded: ' || COALESCE(NEW.file_path, '');
  ELSIF TG_TABLE_NAME = 'stock_movements' THEN
    v_record_id := COALESCE(NEW.movement_id, OLD.movement_id);
    v_details := 'Stock Movement (' || COALESCE(NEW.movement_type, '') || ') qty: ' || COALESCE(NEW.quantity_change::TEXT, '0');
  ELSIF TG_TABLE_NAME = 'branch_inventory' THEN
    v_record_id := COALESCE(NEW.branch_inventory_id, OLD.branch_inventory_id);
    v_details := 'Branch Inventory #' || v_record_id || ' reorder_level=' || COALESCE(NEW.reorder_level::TEXT, '');
  ELSIF TG_TABLE_NAME = 'user_accounts' THEN
    v_record_id := COALESCE(NEW.user_id, OLD.user_id);
    v_details := 'User Account ' || COALESCE(NEW.email, OLD.email) || ' status=' || COALESCE(NEW.account_status, '');
  ELSIF TG_TABLE_NAME = 'system_settings' THEN
    v_record_id := COALESCE(NEW.setting_id, OLD.setting_id);
    v_details := 'System Setting "' || COALESCE(NEW.setting_key, OLD.setting_key) || '" updated';
  ELSE
    v_record_id := NULL;
    v_details := TG_OP || ' on ' || TG_TABLE_NAME;
  END IF;

  INSERT INTO public.audit_logs (
    user_id,
    module_name,
    action_type,
    target_entity,
    target_record_id,
    details,
    created_at
  )
  VALUES (
    v_actor_id,
    v_module,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_details,
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_bookings ON public.bookings;
CREATE TRIGGER trg_audit_bookings
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger('BOOKING_MANAGEMENT');

DROP TRIGGER IF EXISTS trg_audit_service_orders ON public.service_orders;
CREATE TRIGGER trg_audit_service_orders
AFTER INSERT OR UPDATE OR DELETE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger('ORDER_MANAGEMENT');

DROP TRIGGER IF EXISTS trg_audit_shoe_assessments ON public.shoe_assessments;
CREATE TRIGGER trg_audit_shoe_assessments
AFTER INSERT OR UPDATE OR DELETE ON public.shoe_assessments
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger('ASSESSMENT_DOCUMENTATION');

DROP TRIGGER IF EXISTS trg_audit_assessment_photos ON public.assessment_photos;
CREATE TRIGGER trg_audit_assessment_photos
AFTER INSERT OR UPDATE OR DELETE ON public.assessment_photos
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger('ASSESSMENT_DOCUMENTATION');

DROP TRIGGER IF EXISTS trg_audit_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_audit_stock_movements
AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger('INVENTORY_MANAGEMENT');

DROP TRIGGER IF EXISTS trg_audit_branch_inventory ON public.branch_inventory;
CREATE TRIGGER trg_audit_branch_inventory
AFTER INSERT OR UPDATE OR DELETE ON public.branch_inventory
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger('INVENTORY_MANAGEMENT');

DROP TRIGGER IF EXISTS trg_audit_user_accounts ON public.user_accounts;
CREATE TRIGGER trg_audit_user_accounts
AFTER INSERT OR UPDATE OR DELETE ON public.user_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger('USER_MANAGEMENT');

DROP TRIGGER IF EXISTS trg_audit_system_settings ON public.system_settings;
CREATE TRIGGER trg_audit_system_settings
AFTER INSERT OR UPDATE OR DELETE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_trigger('SYSTEM_ADMINISTRATION');
