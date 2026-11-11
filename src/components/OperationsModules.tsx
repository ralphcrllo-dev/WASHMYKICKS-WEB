import React, { useRef, useState } from 'react'
import {
  Bell,
  Camera,
  Check,
  Package,
  Plus,
  Search,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react'

/* ============================================================================
   SHARED TYPES & INITIAL DATA FOR DOCUMENTATION & INVENTORY
   ============================================================================ */

export type ShoeAngleKey = 'left' | 'right' | 'toe' | 'sole'

export type AnglePhotoPair = {
  before: string | null
  after: string | null
}

export type ShoeDocumentation = Record<ShoeAngleKey, AnglePhotoPair>

export const ANGLE_META: {
  key: ShoeAngleKey
  tabLabel: string
  setTitle: string
  shortLabel: string
}[] = [
  { key: 'left', tabLabel: 'LEFT SIDE', setTitle: 'Left profile', shortLabel: 'Left side' },
  { key: 'right', tabLabel: 'RIGHT SIDE', setTitle: 'Right profile', shortLabel: 'Right side' },
  { key: 'toe', tabLabel: 'TOE BOX', setTitle: 'Toe box', shortLabel: 'Toe' },
  { key: 'sole', tabLabel: 'SOLE', setTitle: 'Outsole', shortLabel: 'Sole' },
]

export function createDefaultDocumentation(): ShoeDocumentation {
  return {
    left: {
      before: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
      after: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=80',
    },
    right: {
      before: 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?auto=format&fit=crop&w=900&q=80',
      after: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=900&q=80',
    },
    toe: {
      before: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=900&q=80',
      after: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=80',
    },
    sole: {
      before: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=900&q=80',
      after: null, // Matches screenshot: "Outsole — After photo needed — Upload"
    },
  }
}

export type InventoryRecord = {
  id: string
  name: string
  category:
    | 'Cleaning Chemicals'
    | 'Shoe Protectors'
    | 'Brushes'
    | 'Packaging Materials'
    | 'Restoration Supplies'
  branch: string
  stock: number
  target: number
}

export const INITIAL_INVENTORY_RECORDS: InventoryRecord[] = [
  {
    id: 'inv-1',
    name: 'Premium Cleaner 1L',
    category: 'Cleaning Chemicals',
    branch: 'Wash My Kicks – San Juan City',
    stock: 18,
    target: 40,
  },
  {
    id: 'inv-2',
    name: 'Water Repellent 250ml',
    category: 'Shoe Protectors',
    branch: 'Wash My Kicks – San Juan City',
    stock: 7,
    target: 25,
  },
  {
    id: 'inv-3',
    name: 'Soft Bristle Brush',
    category: 'Brushes',
    branch: 'Wash My Kicks – San Juan City',
    stock: 42,
    target: 30,
  },
  {
    id: 'inv-4',
    name: 'WMK Shoe Box',
    category: 'Packaging Materials',
    branch: 'Wash My Kicks – San Juan City',
    stock: 86,
    target: 100,
  },
  {
    id: 'inv-5',
    name: 'Angelus White Paint',
    category: 'Restoration Supplies',
    branch: 'Wash My Kicks – San Juan City',
    stock: 14,
    target: 20,
  },
  {
    id: 'inv-6',
    name: 'De-Yellowing UV Sole Sauce',
    category: 'Restoration Supplies',
    branch: 'Wash My Kicks – Quezon City',
    stock: 9,
    target: 30,
  },
  {
    id: 'inv-7',
    name: 'Premium Cleaner 1L',
    category: 'Cleaning Chemicals',
    branch: 'Wash My Kicks – Pasig City',
    stock: 34,
    target: 40,
  },
  {
    id: 'inv-8',
    name: 'Microfiber Towel Pack',
    category: 'Brushes',
    branch: 'Wash My Kicks – Pateros',
    stock: 0,
    target: 25,
  },
]

export function getInventoryStatus(stock: number, target: number): 'Healthy' | 'Low' | 'Critical' | 'Out of Stock' {
  if (stock <= 0) return 'Out of Stock'
  const ratio = stock / Math.max(target, 1)
  if (ratio <= 0.3) return 'Critical'
  if (ratio < 0.9) return 'Low'
  return 'Healthy'
}

/* ============================================================================
   UNIFIED STATUS COLOR SYSTEM (BADGES, DROPDOWNS & TIMELINE FLOW)
   ============================================================================ */

export type CanonicalOrderStatus =
  | 'Pending Assessment'
  | 'In Progress'
  | 'Quality Check'
  | 'Ready for Pickup'
  | 'Completed'

export type StatusColorMeta = {
  canonical: CanonicalOrderStatus
  cssClass: string
  bg: string
  text: string
  border: string
  indicator: string
  purpose: string
  meaning: string
  stageIndex: number
}

export const SERVICE_STATUS_FLOW: StatusColorMeta[] = [
  {
    canonical: 'Pending Assessment',
    cssClass: 'status-pending',
    bg: '#FDEAEA',
    text: '#D32F2F',
    border: '#EF5350',
    indicator: '🔴',
    purpose: 'Waiting for assessment by staff.',
    meaning: 'Requires immediate attention.',
    stageIndex: 0,
  },
  {
    canonical: 'In Progress',
    cssClass: 'status-progress',
    bg: '#E3F2FD',
    text: '#1976D2',
    border: '#64B5F6',
    indicator: '🔵',
    purpose: 'Service is currently being performed.',
    meaning: 'Active service process.',
    stageIndex: 1,
  },
  {
    canonical: 'Quality Check',
    cssClass: 'status-qc',
    bg: '#F3E5F5',
    text: '#7B1FA2',
    border: '#BA68C8',
    indicator: '🟣',
    purpose: 'Service completed and under inspection.',
    meaning: 'Verification stage.',
    stageIndex: 2,
  },
  {
    canonical: 'Ready for Pickup',
    cssClass: 'status-ready',
    bg: '#FFF3E0',
    text: '#F57C00',
    border: '#FFB74D',
    indicator: '🟠',
    purpose: 'Ready for release to customer.',
    meaning: 'Waiting for customer collection.',
    stageIndex: 3,
  },
  {
    canonical: 'Completed',
    cssClass: 'status-completed',
    bg: '#E8F5E9',
    text: '#2E7D32',
    border: '#66BB6A',
    indicator: '🟢',
    purpose: 'Order fully completed.',
    meaning: 'Successfully completed.',
    stageIndex: 4,
  },
]

export function getStatusColorMeta(status: string): StatusColorMeta {
  const s = (status || '').trim().toLowerCase()
  if (s === 'completed' || s === 'active' || s === 'healthy') {
    return SERVICE_STATUS_FLOW[4]
  }
  if (s === 'ready for pickup' || s === 'ready') {
    return SERVICE_STATUS_FLOW[3]
  }
  if (s === 'quality check') {
    return SERVICE_STATUS_FLOW[2]
  }
  if (s === 'in progress' || s === 'in service') {
    return SERVICE_STATUS_FLOW[1]
  }
  return SERVICE_STATUS_FLOW[0]
}

export function StatusBadge({
  status,
  displayLabel,
}: {
  status: string
  displayLabel?: string
}) {
  const meta = getStatusColorMeta(status)
  return (
    <span
      className={`wmk-status-badge ${meta.cssClass}`}
      style={{
        backgroundColor: meta.bg,
        color: meta.text,
        border: `1px solid ${meta.border}`,
      }}
      title={`${meta.canonical}: ${meta.meaning}`}
    >
      <span>{displayLabel || status}</span>
    </span>
  )
}

export function StatusSelect({
  value,
  onChange,
  fullWidth = false,
}: {
  value: string
  onChange: (nextStatus: CanonicalOrderStatus) => void
  fullWidth?: boolean
}) {
  const meta = getStatusColorMeta(value)
  return (
    <select
      className="wmk-status-select"
      value={meta.canonical}
      onChange={(e) => onChange(e.target.value as CanonicalOrderStatus)}
      style={{
        backgroundColor: meta.bg,
        color: meta.text,
        border: `1.5px solid ${meta.border}`,
        width: fullWidth ? '100%' : undefined,
        padding: fullWidth ? '12px 14px' : '6px 11px',
        fontSize: fullWidth ? 13.5 : 12,
        borderRadius: fullWidth ? 10 : 8,
      }}
    >
      {SERVICE_STATUS_FLOW.map((opt) => (
        <option
          key={opt.canonical}
          value={opt.canonical}
          style={{
            backgroundColor: opt.bg,
            color: opt.text,
            fontWeight: 700,
          }}
        >
          {opt.canonical}
        </option>
      ))}
    </select>
  )
}

export function ServiceStatusTimeline({ currentStatus }: { currentStatus: string }) {
  const activeMeta = getStatusColorMeta(currentStatus)
  return (
    <div className="wmk-timeline-flow">
      {SERVICE_STATUS_FLOW.map((step, index) => {
        const isReached = index <= activeMeta.stageIndex
        const isCurrent = index === activeMeta.stageIndex
        return (
          <div
            key={step.canonical}
            className="wmk-timeline-step"
            style={
              isReached
                ? {
                    backgroundColor: step.bg,
                    borderColor: step.border,
                    color: step.text,
                    boxShadow: isCurrent ? `0 0 0 2px ${step.border}55` : 'none',
                  }
                : undefined
            }
          >
            <div className="wmk-timeline-step-top">
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  color: isReached ? step.text : '#9ca3af',
                }}
              >
                STAGE 0{index + 1}
              </span>
            </div>
            <b style={{ color: isReached ? step.text : '#374151' }}>{step.canonical}</b>
            <small style={{ color: isReached ? step.text : '#6b7280' }}>{step.meaning}</small>
          </div>
        )
      })}
    </div>
  )
}

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ============================================================================
   1. BEFORE & AFTER DOCUMENTATION MODULE (DIRECT 4-ANGLE PHOTO UPLOAD)
   ============================================================================ */

export type DocOrderSummary = {
  id: string
  customer: string
  shoe: string
  service: string
  status: string
  docs: ShoeDocumentation
}

export function BeforeAfterDocumentationModule({
  orders,
  selectedOrderId,
  onSelectOrder,
  onUploadAnglePhoto,
  onUpdateOrderStatus,
  onBackToDashboard,
}: {
  orders: DocOrderSummary[]
  selectedOrderId: string
  onSelectOrder: (orderId: string) => void
  onUploadAnglePhoto: (orderId: string, angle: ShoeAngleKey, side: 'before' | 'after', dataUrl: string) => void
  onUpdateOrderStatus: (orderId: string, nextStatus: any) => void
  onBackToDashboard: () => void
}) {
  const [activeAngle, setActiveAngle] = useState<ShoeAngleKey>('toe')
  const [replaceMenuAngle, setReplaceMenuAngle] = useState<ShoeAngleKey | null>(null)
  const [pendingUploadTarget, setPendingUploadTarget] = useState<{
    angle: ShoeAngleKey
    side: 'before' | 'after'
  } | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0]
  const currentDocs = activeOrder?.docs || createDefaultDocumentation()
  const activePair = currentDocs[activeAngle]
  const activeMeta = ANGLE_META.find((a) => a.key === activeAngle) || ANGLE_META[2]

  const triggerFilePicker = (angle: ShoeAngleKey, side: 'before' | 'after') => {
    setActiveAngle(angle)
    setPendingUploadTarget({ angle, side })
    setReplaceMenuAngle(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUploadTarget || !activeOrder) return
    const dataUrl = await readImageFileAsDataUrl(file)
    onUploadAnglePhoto(activeOrder.id, pendingUploadTarget.angle, pendingUploadTarget.side, dataUrl)
  }

  const handleDropPhoto = async (e: React.DragEvent<HTMLDivElement>, side: 'before' | 'after') => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/') || !activeOrder) return
    const dataUrl = await readImageFileAsDataUrl(file)
    onUploadAnglePhoto(activeOrder.id, activeAngle, side, dataUrl)
  }

  const completedAnglesCount = ANGLE_META.filter(
    (a) => Boolean(currentDocs[a.key].before) && Boolean(currentDocs[a.key].after)
  ).length

  return (
    <div>
      {/* Hidden native file input for direct device photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="breadcrumb">
        <button type="button" onClick={onBackToDashboard}>
          Dashboard
        </button>
        <span>&gt;</span>
        <span>Before &amp; after documentation</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <span className="eyebrow">BRANCH OPERATIONS</span>
          <h1 style={{ margin: '6px 0 4px' }}>Before &amp; after documentation</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Compare, document, and approve completed work across Left Side, Right Side, Toe, and Sole.
          </p>
        </div>

        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4b5563' }}>
          Active Job Order
          <select
            value={activeOrder.id}
            onChange={(e) => onSelectOrder(e.target.value)}
            style={{
              display: 'block',
              marginTop: 5,
              padding: '9px 14px',
              borderRadius: 10,
              border: '1px solid #e2e0dc',
              background: '#fff',
              fontSize: 12.5,
              fontWeight: 600,
              minWidth: 250,
            }}
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} · {o.shoe}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="wmk-doc-layout">
        {/* LEFT CARD: SPLIT BEFORE / AFTER COMPARISON + 4 ANGLE TABS */}
        <div className="wmk-doc-main-card">
          <div className="wmk-doc-card-head">
            <div>
              <span className="wmk-order-code">{activeOrder.id}</span>
              <h2 className="wmk-order-shoe">{activeOrder.shoe}</h2>
            </div>
            <StatusBadge status={activeOrder.status} />
          </div>

          {/* Side-by-Side Split Image Comparison */}
          <div className="wmk-split-stage">
            {/* BEFORE HALF */}
            <div
              className="wmk-split-half"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropPhoto(e, 'before')}
            >
              <span className="wmk-corner-tag left">BEFORE · {activeMeta.tabLabel}</span>
              {activePair.before ? (
                <>
                  <img src={activePair.before} alt={`${activeMeta.setTitle} before`} />
                  <button
                    type="button"
                    className="wmk-photo-hover-btn"
                    onClick={() => triggerFilePicker(activeAngle, 'before')}
                  >
                    <Upload size={13} /> Upload / Replace Before
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="wmk-empty-upload-zone"
                  onClick={() => triggerFilePicker(activeAngle, 'before')}
                >
                  <Camera size={28} />
                  <b>Upload {activeMeta.shortLabel} (Before)</b>
                  <small>Click to choose photo or drag &amp; drop</small>
                </button>
              )}
            </div>

            {/* AFTER HALF */}
            <div
              className="wmk-split-half after-pane"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropPhoto(e, 'after')}
            >
              <span className="wmk-corner-tag right">AFTER · {activeMeta.tabLabel}</span>
              {activePair.after ? (
                <>
                  <img src={activePair.after} alt={`${activeMeta.setTitle} after`} />
                  <button
                    type="button"
                    className="wmk-photo-hover-btn"
                    onClick={() => triggerFilePicker(activeAngle, 'after')}
                  >
                    <Upload size={13} /> Upload / Replace After
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="wmk-empty-upload-zone"
                  onClick={() => triggerFilePicker(activeAngle, 'after')}
                >
                  <Camera size={28} />
                  <b>Upload {activeMeta.shortLabel} (After)</b>
                  <small>Click to choose photo from your device</small>
                </button>
              )}
            </div>
          </div>

          {/* Bottom 4 Angle Selector Pills + Quick Direct Upload Buttons */}
          <div className="wmk-angle-bar">
            <div className="wmk-angle-tabs">
              {ANGLE_META.map((item) => {
                const isComplete = Boolean(currentDocs[item.key].before && currentDocs[item.key].after)
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`wmk-angle-pill ${activeAngle === item.key ? 'active' : ''}`}
                    onClick={() => setActiveAngle(item.key)}
                  >
                    {item.tabLabel}
                    {!isComplete && <span className="wmk-angle-dot" title="Photo needed" />}
                  </button>
                )
              })}
            </div>

            <div className="wmk-direct-upload-btns">
              <button
                type="button"
                className="outline"
                style={{ padding: '7px 12px', fontSize: 11.5 }}
                onClick={() => triggerFilePicker(activeAngle, 'before')}
              >
                <Camera size={13} /> Upload {activeMeta.shortLabel} Before
              </button>
              <button
                type="button"
                className="primary"
                style={{ padding: '7px 12px', fontSize: 11.5 }}
                onClick={() => triggerFilePicker(activeAngle, 'after')}
              >
                <Upload size={13} /> Upload {activeMeta.shortLabel} After
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: DOCUMENTATION SET CHECKLIST */}
        <aside className="wmk-doc-side-card">
          <h3>Documentation set</h3>

          <div className="wmk-doc-set-list">
            {ANGLE_META.map((item) => {
              const pair = currentDocs[item.key]
              const hasBefore = Boolean(pair.before)
              const hasAfter = Boolean(pair.after)
              const bothDone = hasBefore && hasAfter

              const subtitle = bothDone
                ? 'Before & after uploaded'
                : !hasBefore && !hasAfter
                ? 'Before & after photos needed'
                : !hasBefore
                ? 'Before photo needed'
                : 'After photo needed'

              return (
                <div
                  key={item.key}
                  className={`wmk-doc-set-row ${activeAngle === item.key ? 'focused' : ''}`}
                  onClick={() => setActiveAngle(item.key)}
                >
                  <div className={`wmk-doc-icon-badge ${bothDone ? 'done' : 'pending'}`}>
                    {bothDone ? <Check size={15} /> : <Camera size={15} />}
                  </div>

                  <div className="wmk-doc-row-text">
                    <b>{item.setTitle}</b>
                    <small>{subtitle}</small>
                  </div>

                  <div className="wmk-doc-row-action" onClick={(e) => e.stopPropagation()}>
                    {bothDone ? (
                      <button
                        type="button"
                        className="wmk-doc-link"
                        onClick={() =>
                          setReplaceMenuAngle(replaceMenuAngle === item.key ? null : item.key)
                        }
                      >
                        Replace
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="wmk-doc-link"
                        onClick={() =>
                          triggerFilePicker(item.key, !hasBefore ? 'before' : 'after')
                        }
                      >
                        Upload
                      </button>
                    )}

                    {replaceMenuAngle === item.key && (
                      <div className="wmk-replace-popover">
                        <button
                          type="button"
                          onClick={() => triggerFilePicker(item.key, 'before')}
                        >
                          Upload Before photo
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerFilePicker(item.key, 'after')}
                        >
                          Upload After photo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="wmk-doc-set-footer">
            <small style={{ display: 'block', textAlign: 'center', color: '#9ca3af', fontSize: 11, marginBottom: 10 }}>
              {completedAnglesCount} of 4 shoe angles complete
            </small>
            <button
              type="button"
              className={`wmk-update-svc-btn ${completedAnglesCount === 4 ? 'ready' : ''}`}
              onClick={() => setStatusModalOpen(true)}
            >
              Update service status
            </button>
          </div>
        </aside>
      </div>

      {/* Update Service Status Modal */}
      {statusModalOpen && (
        <div className="wmk-modal-backdrop" onClick={() => setStatusModalOpen(false)}>
          <div className="wmk-modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow">DOCUMENTATION APPROVAL</span>
              <button type="button" onClick={() => setStatusModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <h3 style={{ fontSize: 20, margin: '8px 0 6px' }}>Update service status</h3>
            <p style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 16 }}>
              Approve documentation for <b>{activeOrder.id}</b> ({activeOrder.shoe}) and move order forward:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SERVICE_STATUS_FLOW.map((st) => (
                <button
                  key={st.canonical}
                  type="button"
                  style={{
                    justifyContent: 'center',
                    padding: '11px 16px',
                    borderRadius: 10,
                    backgroundColor: st.bg,
                    color: st.text,
                    border: `1.5px solid ${st.border}`,
                    fontWeight: 700,
                    fontSize: 12.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onClick={() => {
                    onUpdateOrderStatus(activeOrder.id, st.canonical)
                    setStatusModalOpen(false)
                  }}
                >
                  <span>Mark as {st.canonical}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   2. SHOE ASSESSMENT MODULE (MATCHING SCREENSHOT 3 + DIRECT PHOTO UPLOAD)
   ============================================================================ */

const INTAKE_CONDITIONS = [
  'Heavy surface stains',
  'Yellowed midsole',
  'Strong odor',
  'Sole separation',
  'Torn upper',
  'Faded color',
  'Damaged laces',
  'Creasing',
]

export function StaffShoeAssessmentModule({
  orders,
  selectedOrderId,
  onSelectOrder,
  onCompleteAssessment,
  onSaveDraft,
  onUploadIntakePhoto,
}: {
  orders: DocOrderSummary[]
  selectedOrderId: string
  onSelectOrder: (id: string) => void
  onCompleteAssessment: (orderId: string, notes: string, conditions: string[], shoeLabel: string) => void
  onSaveDraft: (msg: string) => void
  onUploadIntakePhoto: (orderId: string, angle: ShoeAngleKey, dataUrl: string) => void
}) {
  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0]

  const [brand, setBrand] = useState('Nike')
  const [model, setModel] = useState('Air Max 97')
  const [material, setMaterial] = useState('Mesh / Synthetic leather')
  const [colorway, setColorway] = useState('Silver Bullet')
  const [checked, setChecked] = useState<string[]>([
    'Heavy surface stains',
    'Yellowed midsole',
    'Strong odor',
  ])
  const [damageNotes, setDamageNotes] = useState(
    'Heavy dirt buildup on mesh panels. Mild yellowing along midsole. No structural tears.'
  )

  const angleInputRef = useRef<HTMLInputElement | null>(null)
  const soleInputRef = useRef<HTMLInputElement | null>(null)

  const toggleItem = (item: string) => {
    setChecked((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]))
  }

  const previewPhoto =
    activeOrder?.docs?.left?.before ||
    'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80'

  const recommended =
    checked.includes('Sole separation') || checked.includes('Torn upper')
      ? { service: 'Shoe Repair + Deep Clean', total: '₱1,450', days: '5–10 days' }
      : checked.includes('Yellowed midsole') || checked.includes('Faded color')
      ? { service: 'Restoration + Deep Clean', total: '₱1,850', days: '7–10 days' }
      : { service: 'Deep Cleaning', total: '₱650', days: '3–5 days' }

  return (
    <div>
      {/* Direct file inputs for Add angle & Add sole */}
      <input
        ref={angleInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f || !activeOrder) return
          const url = await readImageFileAsDataUrl(f)
          onUploadIntakePhoto(activeOrder.id, 'left', url)
        }}
      />
      <input
        ref={soleInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f || !activeOrder) return
          const url = await readImageFileAsDataUrl(f)
          onUploadIntakePhoto(activeOrder.id, 'sole', url)
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <span className="eyebrow">BRANCH OPERATIONS</span>
          <h1 style={{ margin: '6px 0 4px' }}>Shoe assessment</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            {activeOrder.id} · {activeOrder.customer}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={activeOrder.id}
            onChange={(e) => onSelectOrder(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 9,
              border: '1px solid #e2e0dc',
              background: '#fff',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} · {o.customer}
              </option>
            ))}
          </select>
          <StatusBadge status={activeOrder.status} />
        </div>
      </div>

      <div className="wmk-assess-layout">
        {/* LEFT FORM CARD */}
        <form
          className="wmk-doc-main-card"
          onSubmit={(e) => {
            e.preventDefault()
            onCompleteAssessment(
              activeOrder.id,
              damageNotes,
              checked,
              `${brand} ${model} · ${colorway}`
            )
          }}
        >
          {/* Section 01 */}
          <div className="wmk-step-heading">
            <span className="wmk-step-num-box">01</span>
            <div>
              <h3>Shoe information</h3>
              <small>Identify the pair and primary materials.</small>
            </div>
          </div>

          <div className="wizard-grid-2" style={{ marginBottom: 26 }}>
            <label className="wmk-field-label">
              Shoe brand
              <input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label className="wmk-field-label">
              Model
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
            <label className="wmk-field-label">
              Primary material
              <input value={material} onChange={(e) => setMaterial(e.target.value)} />
            </label>
            <label className="wmk-field-label">
              Colorway
              <input value={colorway} onChange={(e) => setColorway(e.target.value)} />
            </label>
          </div>

          {/* Section 02 */}
          <div className="wmk-step-heading">
            <span className="wmk-step-num-box">02</span>
            <div>
              <h3>Condition checklist</h3>
              <small>Select all conditions observed during intake.</small>
            </div>
          </div>

          <div className="wizard-grid-2" style={{ marginBottom: 22 }}>
            {INTAKE_CONDITIONS.map((cond) => {
              const isChecked = checked.includes(cond)
              return (
                <button
                  key={cond}
                  type="button"
                  className={`wmk-check-tile ${isChecked ? 'checked' : ''}`}
                  onClick={() => toggleItem(cond)}
                >
                  <span className={`wmk-checkbox-sq ${isChecked ? 'checked' : ''}`}>
                    {isChecked && <Check size={12} />}
                  </span>
                  <span>{cond}</span>
                </button>
              )
            })}
          </div>

          <label className="wmk-field-label">
            Damage notes
            <input
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              placeholder="Log mesh dirt, midsole oxidation, creasing, or structural notes..."
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button
              type="button"
              className="outline"
              onClick={() => onSaveDraft(`Draft saved for ${activeOrder.id}.`)}
            >
              Save draft
            </button>
            <button type="submit" className="primary">
              Complete assessment
            </button>
          </div>
        </form>

        {/* RIGHT PHOTOS & RECOMMENDED SUMMARY CARD */}
        <aside className="wmk-doc-side-card">
          <b style={{ fontSize: 12.5, display: 'block', marginBottom: 10 }}>Before photos</b>
          <img
            src={previewPhoto}
            alt="Intake sneaker preview"
            style={{ width: '100%', height: 195, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }}
          />

          <div className="wizard-grid-2" style={{ gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              className="wmk-upload-tile-sm"
              onClick={() => angleInputRef.current?.click()}
            >
              <Camera size={16} />
              <span>Add angle</span>
            </button>
            <button
              type="button"
              className="wmk-upload-tile-sm"
              onClick={() => soleInputRef.current?.click()}
            >
              <Camera size={16} />
              <span>Add sole</span>
            </button>
          </div>

          <div className="wmk-dark-quote-card">
            <span className="wmk-dark-eyebrow">RECOMMENDED SERVICE</span>
            <strong>{recommended.service}</strong>
            <div className="wmk-dark-row">
              <span>Estimated total</span>
              <b>{recommended.total}</b>
            </div>
            <div className="wmk-dark-row">
              <span>Turnaround</span>
              <b>{recommended.days}</b>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ============================================================================
   3. ASSIGNED SERVICES MODULE (MATCHING SCREENSHOT 2)
   ============================================================================ */

export function StaffAssignedServicesModule({
  orders,
  selectedOrderId,
  onSelectOrder,
  onSaveStatus,
  onOpenDocumentation,
  onBackToDashboard,
}: {
  orders: DocOrderSummary[]
  selectedOrderId: string
  onSelectOrder: (id: string) => void
  onSaveStatus: (id: string, status: any) => void
  onOpenDocumentation: (id: string) => void
  onBackToDashboard: () => void
}) {
  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0]
  const [statusChoice, setStatusChoice] = useState<string>(activeOrder?.status || 'In Progress')

  return (
    <div>
      <div className="breadcrumb">
        <button type="button" onClick={onBackToDashboard}>
          Dashboard
        </button>
        <span>&gt;</span>
        <span>Assigned services</span>
      </div>
      <span className="eyebrow">BRANCH OPERATIONS</span>
      <h1 style={{ margin: '6px 0 4px' }}>Assigned services</h1>
      <p style={{ marginBottom: 24 }}>Update progress for work assigned to you.</p>

      <div className="wmk-assess-layout">
        <div className="wmk-doc-main-card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                className={o.id === activeOrder.id ? 'primary' : 'outline'}
                style={{ padding: '6px 12px', fontSize: 11.5 }}
                onClick={() => {
                  onSelectOrder(o.id)
                  setStatusChoice(o.status)
                }}
              >
                {o.id}
              </button>
            ))}
          </div>

          <div className="wmk-doc-card-head" style={{ marginBottom: 18 }}>
            <div>
              <span className="wmk-order-code">{activeOrder.id}</span>
              <h2 className="wmk-order-shoe">{activeOrder.shoe}</h2>
            </div>
            <StatusBadge status={activeOrder.status} />
          </div>

          <label className="wmk-field-label" style={{ marginBottom: 20 }}>
            Update service progress
            <div style={{ marginTop: 8 }}>
              <StatusSelect
                value={statusChoice}
                onChange={(next) => setStatusChoice(next)}
                fullWidth
              />
            </div>
          </label>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary"
              onClick={() => onSaveStatus(activeOrder.id, statusChoice)}
            >
              Save Status
            </button>
            <button
              type="button"
              className="outline"
              onClick={() => onOpenDocumentation(activeOrder.id)}
            >
              Open Documentation
            </button>
          </div>
        </div>

        <aside className="wmk-doc-side-card">
          <h3 style={{ marginBottom: 18 }}>My workload</h3>
          {[
            ['Cleaning', 82],
            ['Restoration', 64],
            ['Repair', 48],
          ].map(([label, pct]) => (
            <div key={String(label)} className="wmk-workload-row">
              <span>{label}</span>
              <div className="wmk-workload-bar">
                <div style={{ width: `${pct}%` }} />
              </div>
              <b>{pct}%</b>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}

/* ============================================================================
   4. INVENTORY MANAGEMENT MODULE (SHARED ON BOTH STAFF & ADMIN RBAC)
   ============================================================================ */

type InventoryModalAction = 'add' | 'reduce' | 'transfer' | 'update' | null

export function InventoryManagementModule({
  roleLabel,
  branches,
  defaultBranch,
  inventory,
  setInventory,
  onBackToDashboard,
  onNotify,
}: {
  roleLabel: 'STAFF' | 'ADMINISTRATION'
  branches: string[]
  defaultBranch?: string
  inventory: InventoryRecord[]
  setInventory: React.Dispatch<React.SetStateAction<InventoryRecord[]>>
  onBackToDashboard: () => void
  onNotify: (msg: string) => void
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [branchFilter, setBranchFilter] = useState('All branches')
  const [onlyLowAlerts, setOnlyLowAlerts] = useState(false)

  // Modal state (matches Screenshot 5)
  const [modalMode, setModalMode] = useState<InventoryModalAction>(null)
  const [modalItemName, setModalItemName] = useState('Premium Cleaner 1L')
  const [modalCategory, setModalCategory] = useState<InventoryRecord['category']>('Cleaning Chemicals')
  const [modalBranch, setModalBranch] = useState(defaultBranch || branches[0])
  const [modalDestBranch, setModalDestBranch] = useState(branches[1] || branches[0])
  const [modalQty, setModalQty] = useState<number>(5)

  const categories: InventoryRecord['category'][] = [
    'Cleaning Chemicals',
    'Shoe Protectors',
    'Brushes',
    'Packaging Materials',
    'Restoration Supplies',
  ]

  const uniqueItemNames = Array.from(new Set(inventory.map((i) => i.name)))

  // Compute KPI metrics
  const totalSkus = 240 + inventory.length
  const lowAlertsCount =
    19 +
    inventory.filter((i) => {
      const st = getInventoryStatus(i.stock, i.target)
      return st === 'Low' || st === 'Critical'
    }).length
  const outOfStockCount = 5 + inventory.filter((i) => i.stock <= 0).length
  const healthyCount = totalSkus - lowAlertsCount - outOfStockCount

  const filtered = inventory.filter((item) => {
    const matchesSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.branch.toLowerCase().includes(search.toLowerCase())
    const matchesCat = categoryFilter === 'All categories' || item.category === categoryFilter
    const matchesBranch = branchFilter === 'All branches' || item.branch === branchFilter
    const st = getInventoryStatus(item.stock, item.target)
    const matchesAlert = !onlyLowAlerts || st !== 'Healthy'
    return matchesSearch && matchesCat && matchesBranch && matchesAlert
  })

  const openModal = (
    mode: InventoryModalAction,
    preset?: { name: string; branch: string; category?: InventoryRecord['category']; qty?: number }
  ) => {
    setModalMode(mode)
    if (preset) {
      setModalItemName(preset.name)
      setModalBranch(preset.branch)
      if (preset.category) setModalCategory(preset.category)
      setModalQty(preset.qty ?? 5)
    } else {
      setModalQty(5)
    }
  }

  const handleConfirmModal = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = Math.max(1, Number(modalQty) || 1)

    if (modalMode === 'reduce') {
      setInventory((prev) =>
        prev.map((item) =>
          item.name === modalItemName && item.branch === modalBranch
            ? { ...item, stock: Math.max(0, item.stock - qty) }
            : item
        )
      )
      onNotify(`Reduced ${modalItemName} by ${qty} units at ${modalBranch}.`)
    } else if (modalMode === 'add') {
      setInventory((prev) => {
        const exists = prev.find((i) => i.name === modalItemName && i.branch === modalBranch)
        if (exists) {
          return prev.map((i) =>
            i.id === exists.id ? { ...i, stock: i.stock + qty } : i
          )
        }
        return [
          {
            id: `inv-${Date.now()}`,
            name: modalItemName,
            category: modalCategory,
            branch: modalBranch,
            stock: qty,
            target: Math.max(25, qty * 2),
          },
          ...prev,
        ]
      })
      onNotify(`Added +${qty} units of ${modalItemName} to ${modalBranch}.`)
    } else if (modalMode === 'update') {
      setInventory((prev) =>
        prev.map((item) =>
          item.name === modalItemName && item.branch === modalBranch
            ? { ...item, stock: Math.max(0, qty) }
            : item
        )
      )
      onNotify(`Updated ${modalItemName} stock to ${qty} units at ${modalBranch}.`)
    } else if (modalMode === 'transfer') {
      setInventory((prev) => {
        const updated = prev.map((item) =>
          item.name === modalItemName && item.branch === modalBranch
            ? { ...item, stock: Math.max(0, item.stock - qty) }
            : item
        )
        const destMatch = updated.find(
          (i) => i.name === modalItemName && i.branch === modalDestBranch
        )
        if (destMatch) {
          return updated.map((i) =>
            i.id === destMatch.id ? { ...i, stock: i.stock + qty } : i
          )
        }
        const src = prev.find((i) => i.name === modalItemName)
        return [
          ...updated,
          {
            id: `inv-${Date.now()}`,
            name: modalItemName,
            category: src?.category || 'Cleaning Chemicals',
            branch: modalDestBranch,
            stock: qty,
            target: src?.target || 30,
          },
        ]
      })
      onNotify(`Transferred ${qty} units of ${modalItemName} from ${modalBranch} to ${modalDestBranch}.`)
    }

    setModalMode(null)
  }

  return (
    <div>
      <div className="breadcrumb">
        <button type="button" onClick={onBackToDashboard}>
          Dashboard
        </button>
        <span>&gt;</span>
        <span>Inventory management</span>
      </div>

      {/* Header Row with + Add stock CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <span className="eyebrow">{roleLabel === 'STAFF' ? 'BRANCH OPERATIONS' : 'ADMINISTRATION'}</span>
          <h1 style={{ margin: '6px 0 4px' }}>Inventory management</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Stock visibility across San Juan, Quezon City, Pasig, Pateros, Montalban, Morong, and Bacoor.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          style={{ padding: '12px 20px', borderRadius: 10 }}
          onClick={() => openModal('add')}
        >
          <Plus size={16} /> Add stock
        </button>
      </div>

      {/* 4 KPI Summary Cards matching Screenshot 4 */}
      <div className="wmk-inv-kpi-grid">
        <article className="wmk-inv-kpi-card">
          <div className="wmk-inv-kpi-icon dark">
            <Package size={18} />
          </div>
          <div>
            <span>Total SKUs</span>
            <b>{totalSkus}</b>
            <small>5 categories</small>
          </div>
        </article>

        <article className="wmk-inv-kpi-card">
          <div className="wmk-inv-kpi-icon green">
            <Check size={18} />
          </div>
          <div>
            <span>Healthy stock</span>
            <b>{healthyCount}</b>
            <small>{Math.round((healthyCount / totalSkus) * 100)}% of inventory</small>
          </div>
        </article>

        <article className="wmk-inv-kpi-card">
          <div className="wmk-inv-kpi-icon red">
            <Bell size={18} />
          </div>
          <div>
            <span>Low stock alerts</span>
            <b>{lowAlertsCount}</b>
            <small>Needs attention</small>
          </div>
        </article>

        <article className="wmk-inv-kpi-card">
          <div className="wmk-inv-kpi-icon dark">
            <ShieldAlert size={18} />
          </div>
          <div>
            <span>Out of stock</span>
            <b>{outOfStockCount}</b>
            <small>Reorder immediately</small>
          </div>
        </article>
      </div>

      {/* Filter Bar Card */}
      <div className="wmk-inv-filter-card">
        <div className="wmk-inv-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory"
          />
        </div>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="All categories">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="All branches">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Main Inventory Rows Card */}
      <div className="wmk-inv-list-card">
        {filtered.map((item) => {
          const status = getInventoryStatus(item.stock, item.target)
          const pct = Math.min(100, Math.round((item.stock / Math.max(item.target, 1)) * 100))
          const badgeClass =
            status === 'Healthy'
              ? 'green'
              : status === 'Low'
              ? 'amber'
              : 'red'

          return (
            <div key={item.id} className="wmk-inv-row">
              <div className="wmk-inv-item-left">
                <div className="wmk-inv-box-icon">
                  <Package size={16} />
                </div>
                <div>
                  <b>{item.name}</b>
                  <small>
                    {item.category} · {item.branch.replace('Wash My Kicks – ', '')}
                  </small>
                </div>
              </div>

              <div className="wmk-inv-item-right">
                <div className="wmk-inv-progress">
                  <div style={{ width: `${pct}%` }} />
                </div>
                <span className="wmk-inv-units">
                  {item.stock} / {item.target} units
                </span>
                <span className={`status-pill ${badgeClass}`}>{status}</span>
                <button
                  type="button"
                  className="wmk-doc-link"
                  onClick={() =>
                    openModal('update', {
                      name: item.name,
                      branch: item.branch,
                      category: item.category,
                      qty: item.stock,
                    })
                  }
                >
                  Update
                </button>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            No inventory items match the selected filter.
          </div>
        )}

        {/* Bottom Action Buttons matching Screenshot 4 */}
        <div className="wmk-inv-footer-actions">
          <button type="button" className="outline" onClick={() => openModal('reduce')}>
            Reduce stock
          </button>
          <button type="button" className="outline" onClick={() => openModal('transfer')}>
            Transfer stock
          </button>
          <button
            type="button"
            className={onlyLowAlerts ? 'primary' : 'outline'}
            onClick={() => setOnlyLowAlerts(!onlyLowAlerts)}
          >
            {onlyLowAlerts ? 'Showing low-stock alerts (Show all)' : 'View low-stock alerts'}
          </button>
        </div>
      </div>

      {/* INVENTORY ACTION MODAL (MATCHING SCREENSHOT 5) */}
      {modalMode && (
        <div className="wmk-modal-backdrop" onClick={() => setModalMode(null)}>
          <form
            className="wmk-modal-card"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmModal}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="eyebrow">INVENTORY ACTION</span>
                <h3 style={{ fontSize: 20, margin: '4px 0 14px' }}>
                  {modalMode === 'reduce'
                    ? 'Reduce stock'
                    : modalMode === 'add'
                    ? 'Add stock'
                    : modalMode === 'transfer'
                    ? 'Transfer stock'
                    : 'Update stock count'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <label className="wmk-field-label" style={{ marginBottom: 14 }}>
              Inventory item
              {modalMode === 'add' ? (
                <input
                  list="wmk-sku-suggestions"
                  required
                  value={modalItemName}
                  onChange={(e) => setModalItemName(e.target.value)}
                  placeholder="Select or type SKU name..."
                />
              ) : (
                <select
                  value={modalItemName}
                  onChange={(e) => setModalItemName(e.target.value)}
                >
                  {uniqueItemNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
              <datalist id="wmk-sku-suggestions">
                {uniqueItemNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>

            {modalMode === 'add' && (
              <label className="wmk-field-label" style={{ marginBottom: 14 }}>
                Category
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value as InventoryRecord['category'])}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="wmk-field-label" style={{ marginBottom: 14 }}>
              {modalMode === 'transfer' ? 'Source branch' : 'Branch'}
              <select value={modalBranch} onChange={(e) => setModalBranch(e.target.value)}>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>

            {modalMode === 'transfer' && (
              <label className="wmk-field-label" style={{ marginBottom: 14 }}>
                Destination branch
                <select
                  value={modalDestBranch}
                  onChange={(e) => setModalDestBranch(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="wmk-field-label" style={{ marginBottom: 22 }}>
              {modalMode === 'update' ? 'New unit count' : 'Quantity'}
              <input
                type="number"
                min={0}
                required
                value={modalQty}
                onChange={(e) => setModalQty(Number(e.target.value))}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
              <button
                type="button"
                style={{ fontWeight: 700, fontSize: 13, color: '#374151', padding: '10px 14px' }}
                onClick={() => setModalMode(null)}
              >
                Cancel
              </button>
              <button type="submit" className="primary" style={{ padding: '12px 20px', borderRadius: 10 }}>
                {modalMode === 'reduce'
                  ? 'Confirm reduce'
                  : modalMode === 'add'
                  ? 'Confirm add'
                  : modalMode === 'transfer'
                  ? 'Confirm transfer'
                  : 'Save stock'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
