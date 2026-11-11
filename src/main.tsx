import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BranchLocatorMap } from './components/BranchLocatorMap'
import {
  createBookingRecord,
  registerCustomerAccount,
  requestPasswordResetEmail,
  signInWithRole,
  signOutSession,
  submitCustomerCrmInteraction,
  triggerDatabaseBackupManifest,
  updateServiceOrderStatus,
  uploadAssessmentPhotoToStorage,
  upsertShoeAssessmentRecord,
} from './lib/api'
import {
  BeforeAfterDocumentationModule,
  INITIAL_INVENTORY_RECORDS,
  InventoryManagementModule,
  InventoryRecord,
  ServiceStatusTimeline,
  ShoeAngleKey,
  ShoeDocumentation,
  StaffAssignedServicesModule,
  StaffShoeAssessmentModule,
  StatusBadge,
  StatusSelect,
  createDefaultDocumentation,
  getInventoryStatus,
} from './components/OperationsModules'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import './styles.css'

/* ============================================================================
   SHARED DATA & TYPES
   ============================================================================ */

type Role = 'customer' | 'staff' | 'admin'

type Service = {
  id: string
  title: string
  copy: string
  price: string
  numericPrice: number
  duration: string
}

const services: Service[] = [
  { id: '01', title: 'Basic Cleaning', copy: 'Exterior clean, midsole care, and freshening.', price: '₱350', numericPrice: 350, duration: '2–3 days' },
  { id: '02', title: 'Deep Cleaning', copy: 'Full upper, sole, insole, and lace deep clean.', price: '₱650', numericPrice: 650, duration: '3–5 days' },
  { id: '03', title: 'Restoration', copy: 'Color revival, de-yellowing, and repainting.', price: 'From ₱1,200', numericPrice: 1200, duration: '7–14 days' },
  { id: '04', title: 'Shoe Repair', copy: 'Sole reglue, stitching, and damage repair.', price: 'From ₱800', numericPrice: 800, duration: '5–10 days' },
  { id: '05', title: 'Shoe Protection', copy: 'Water and stain-repellent premium coating.', price: '₱280', numericPrice: 280, duration: '1 day' },
]

const staffBranches = [
  'Wash My Kicks – San Juan City',
  'Wash My Kicks – Quezon City',
  'Wash My Kicks – Pasig City',
  'Wash My Kicks – Pateros',
  'Wash My Kicks – Montalban Rizal',
  'Wash My Kicks – Morong Rizal',
  'Wash My Kicks – Bacoor Cavite',
]

const wizardBranches = [
  { id: 1, name: 'Wash My Kicks – San Juan City', address: '300 Col. Bonny Serrano Ave., San Juan City', comingSoon: false },
  { id: 2, name: 'Wash My Kicks – Quezon City', address: 'Quezon City, Philippines', comingSoon: false },
  { id: 3, name: 'Wash My Kicks – Pasig City', address: 'Pasig City, Philippines', comingSoon: false },
  { id: 4, name: 'Wash My Kicks – Pateros', address: '402 G. De Borja St., Brgy. Aguho, Pateros', comingSoon: false },
  { id: 5, name: 'Wash My Kicks – Montalban, Rizal', address: 'Montalban, Rizal', comingSoon: false },
  { id: 6, name: 'Wash My Kicks – Morong, Rizal', address: '2nd Floor A5R Commercial Space Rental, Manila East Road, Morong, Rizal', comingSoon: false },
  { id: 7, name: 'Wash My Kicks – Bacoor, Cavite', address: 'Cerritos Trails Molino 3, Bacoor, Cavite', comingSoon: false },
  { id: 8, name: 'Wash My Kicks – 8th Branch', address: 'Location to be announced', comingSoon: true },
]

export type JobOrder = {
  id: string
  customer: string
  email: string
  shoe: string
  service: string
  branch: string
  date: string
  time: string
  price: string
  status: 'Pending Assessment' | 'In Progress' | 'Quality Check' | 'Ready for Pickup' | 'Completed'
  stageIndex: number
  specialist: string
  assessed: boolean
  assessmentNotes?: string
  conditionTags?: string[]
  beforePhoto?: string
  afterPhoto?: string
  docs: ShoeDocumentation
}

const initialOrders: JobOrder[] = [
  {
    id: 'WMK-2026-0046',
    customer: 'Andrea Reyes',
    email: 'andrea.reyes@email.com',
    shoe: 'Nike Air Max 97 · Silver Bullet',
    service: 'Restoration',
    branch: 'Wash My Kicks – San Juan City',
    date: 'March 27, 2026',
    time: '02:00 PM',
    price: '₱1,850',
    status: 'In Progress',
    stageIndex: 3,
    specialist: 'Carlo Mendoza',
    assessed: true,
    assessmentNotes: 'Heavy dirt buildup on mesh panels. Mild yellowing along midsole. No structural tears.',
    conditionTags: ['Heavy surface stains', 'Yellowed midsole', 'Strong odor'],
    docs: createDefaultDocumentation(),
  },
  {
    id: 'WMK-2026-0045',
    customer: 'Paolo Tan',
    email: 'paolo.tan@email.com',
    shoe: 'Jordan 4',
    service: 'Deep Cleaning',
    branch: 'Wash My Kicks – Quezon City',
    date: 'March 26, 2026',
    time: '01:00 PM',
    price: '₱650',
    status: 'Pending Assessment',
    stageIndex: 2,
    specialist: 'Carlo Mendoza',
    assessed: false,
    docs: createDefaultDocumentation(),
  },
  {
    id: 'WMK-2026-0044',
    customer: 'Sam Lee',
    email: 'sam.lee@email.com',
    shoe: 'Adidas Samba',
    service: 'Sole Repair',
    branch: 'Wash My Kicks – Pasig City',
    date: 'March 25, 2026',
    time: '03:30 PM',
    price: '₱800',
    status: 'Quality Check',
    stageIndex: 4,
    specialist: 'Carlo Mendoza',
    assessed: true,
    docs: createDefaultDocumentation(),
  },
  {
    id: 'WMK-2026-0043',
    customer: 'Nicole Cruz',
    email: 'nicole.cruz@email.com',
    shoe: 'New Balance 550',
    service: 'Basic Clean',
    branch: 'Wash My Kicks – Pateros',
    date: 'March 24, 2026',
    time: '11:00 AM',
    price: '₱350',
    status: 'Ready for Pickup',
    stageIndex: 5,
    specialist: 'Marco Santos',
    assessed: true,
    docs: createDefaultDocumentation(),
  },
  {
    id: 'WMK-2026-0042',
    customer: 'John Uy',
    email: 'john.uy@email.com',
    shoe: 'Nike Dunk Low',
    service: 'Restoration',
    branch: 'Wash My Kicks – Montalban, Rizal',
    date: 'March 24, 2026',
    time: '09:30 AM',
    price: '₱1,200',
    status: 'Pending Assessment',
    stageIndex: 1,
    specialist: 'Carlo Mendoza',
    assessed: false,
    docs: createDefaultDocumentation(),
  },
  {
    id: 'WMK-2026-01842',
    customer: 'Juan Dela Cruz',
    email: 'juan.delacruz@email.com',
    shoe: 'Air Jordan 1 Retro High OG "Chicago"',
    service: 'Deep Cleaning',
    branch: 'Wash My Kicks – San Juan City',
    date: 'March 28, 2026',
    time: '10:30 AM',
    price: '₱650',
    status: 'In Progress',
    stageIndex: 3,
    specialist: 'Carlo Mendoza',
    assessed: true,
    assessmentNotes: 'Light midsole oxidation, suede toebox scuffing, insole deep deodorizing required.',
    conditionTags: ['Midsole Yellowing', 'Upper Stains', 'Lace Discoloration'],
    beforePhoto: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    afterPhoto: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=600&q=80',
    docs: createDefaultDocumentation(),
  },
  {
    id: 'WMK-2026-01849',
    customer: 'Angela Mercado',
    email: 'angela.m@email.com',
    shoe: 'New Balance 2002R Protection Pack',
    service: 'Restoration',
    branch: 'Wash My Kicks – San Juan City',
    date: 'March 24, 2026',
    time: '01:00 PM',
    price: '₱1,200',
    status: 'Pending Assessment',
    stageIndex: 2,
    specialist: 'Carlo Mendoza',
    assessed: false,
    docs: createDefaultDocumentation(),
  },
  {
    id: 'WMK-2026-01835',
    customer: 'Jiro Reyes',
    email: 'jiro.reyes@email.com',
    shoe: 'Nike Dunk Low Panda',
    service: 'Basic Cleaning',
    branch: 'Wash My Kicks – Quezon City',
    date: 'March 22, 2026',
    time: '11:00 AM',
    price: '₱350',
    status: 'Ready for Pickup',
    stageIndex: 5,
    specialist: 'Marco Santos',
    assessed: true,
    assessmentNotes: 'Standard mud and crease marks on leather upper.',
    conditionTags: ['Creasing', 'Outsole Dirt'],
    docs: createDefaultDocumentation(),
  },
  {
    id: 'WMK-2026-01790',
    customer: 'Juan Dela Cruz',
    email: 'juan.delacruz@email.com',
    shoe: 'Adidas Samba OG White',
    service: 'Shoe Protection',
    branch: 'Wash My Kicks – San Juan City',
    date: 'March 10, 2026',
    time: '03:00 PM',
    price: '₱280',
    status: 'Completed',
    stageIndex: 5,
    specialist: 'Carlo Mendoza',
    assessed: true,
    assessmentNotes: 'Applied 2 coats of water & stain repellent shield.',
    docs: createDefaultDocumentation(),
  },
]

export type ReviewItem = {
  id: string
  author: string
  service: string
  branch: string
  rating: number
  quote: string
  date: string
}

const initialReviews: ReviewItem[] = [
  { id: 'r1', author: 'Angela M.', service: 'Restoration', branch: 'Wash My Kicks – San Juan City', rating: 5, quote: 'My white pairs looked brand new—honestly unreal.', date: 'March 18, 2026' },
  { id: 'r2', author: 'Jiro R.', service: 'Deep Cleaning', branch: 'Wash My Kicks – Quezon City', rating: 5, quote: 'The progress photos made the whole service feel premium.', date: 'March 15, 2026' },
  { id: 'r3', author: 'Kaye S.', service: 'Shoe Repair', branch: 'Wash My Kicks – Pasig City', rating: 5, quote: 'Fast, meticulous, and totally worth it.', date: 'March 11, 2026' },
]

/* ============================================================================
   ROLE-BASED ACCESS CONTROL (RBAC) MATRIX
   ============================================================================ */

export const RBAC_PERMISSIONS: Record<
  Role,
  {
    allowed: string[]
    restricted: string[]
  }
> = {
  customer: {
    allowed: ['Homepage', 'Book Appointment', 'Track Order', 'Notifications', 'Service History', 'Reviews', 'Profile'],
    restricted: ['Inventory', 'Reports', 'User Management', 'Staff Assignment'],
  },
  staff: {
    allowed: [
      'Job Orders',
      'Assessments',
      'Documentation',
      'Status Updates',
      'Inventory',
      'Assigned Services',
      'Customers',
      'Notifications',
    ],
    restricted: ['System Settings', 'User Management', 'Revenue Reports'],
  },
  admin: {
    allowed: ['All Modules', 'Branches', 'Inventory', 'CRM', 'Job Orders', 'Reports', 'Audit Trail', 'User Management', 'Settings'],
    restricted: [],
  },
}

/* ============================================================================
   BRAND, HEADER & FOOTER (UNCHANGED BRANDING & LAYOUT)
   ============================================================================ */

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button className="brand" type="button" onClick={onClick}>
      <img className="brand-logo" src="./washmykicks-logo.jpg" alt="WashMyKicks shoe cleaning services" />
      <span>
        <b>WASHMYKICKS</b>
        <small>SNEAKER CARE SYSTEM</small>
      </span>
    </button>
  )
}

function Header({
  page,
  setPage,
  activeRole,
}: {
  page: string
  setPage: (page: string) => void
  activeRole: Role | null
}) {
  const [open, setOpen] = useState(false)
  const go = (target: string) => {
    setPage(target)
    setOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <header className="header">
      <Brand onClick={() => go('home')} />
      <button className="menu" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
        {open ? <X /> : <Menu />}
      </button>
      <nav className={open ? 'nav nav-open' : 'nav'}>
        {[
          ['home', 'Home'],
          ['services', 'Services'],
          ['track', 'Track Shoes'],
          ['branches', 'Branches'],
          ['reviews', 'Reviews'],
          ['about', 'About'],
        ].map(([key, label]) => (
          <button key={key} className={page === key ? 'active' : ''} onClick={() => go(key)}>
            {label}
          </button>
        ))}
        {activeRole ? (
          <button className="nav-cta" onClick={() => go(`dashboard-${activeRole}`)}>
            Return to {activeRole[0].toUpperCase() + activeRole.slice(1)} Dashboard
          </button>
        ) : (
          <>
            <button className={page === 'login' ? 'active' : ''} onClick={() => go('login')}>
              Log in
            </button>
            <button className="nav-cta" onClick={() => go('login')}>
              Select Account / Portal
            </button>
          </>
        )}
      </nav>
    </header>
  )
}

function ServiceCard({ service, onClick }: { service: Service; onClick?: () => void }) {
  return (
    <article className="service-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="service-id">{service.id}</div>
      <div>
        <h3>{service.title}</h3>
        <p>{service.copy}</p>
      </div>
      <div className="service-meta">
        <b>{service.price}</b>
        <span>
          <Clock3 size={14} />
          {service.duration}
        </span>
      </div>
      <ChevronRight />
    </article>
  )
}

function Footer({ setPage }: { setPage: (page: string) => void }) {
  return (
    <footer>
      <div className="footer-brand">
        <Brand onClick={() => setPage('home')} />
        <p>Premium sneaker care, now organized from booking to pickup.</p>
      </div>
      <div>
        <b>Explore</b>
        <button onClick={() => setPage('services')}>Services</button>
        <button onClick={() => setPage('track')}>Track order</button>
        <button onClick={() => setPage('branches')}>Branches</button>
      </div>
      <div>
        <b>Portals</b>
        <button onClick={() => setPage('login')}>Account Selection</button>
        <button onClick={() => setPage('login-customer')}>Customer Login</button>
        <button onClick={() => setPage('login-staff')}>Staff Login</button>
        <button onClick={() => setPage('login-admin')}>Administrator Login</button>
      </div>
      <form onSubmit={(e) => e.preventDefault()}>
        <b>Service updates</b>
        <p>Get care tips and branch promos.</p>
        <div className="email">
          <input type="email" placeholder="Your email address" aria-label="Email address" />
          <button type="submit">Join</button>
        </div>
      </form>
      <small className="copyright">© 2026 WashMyKicks. All rights reserved.</small>
    </footer>
  )
}

/* ============================================================================
   PUBLIC PAGES
   ============================================================================ */

function Home({
  setPage,
  onBookBranch,
}: {
  setPage: (page: string) => void
  onBookBranch: (branchName: string, branchId: number) => void
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">MANILA'S TRUSTED SNEAKER CARE</span>
          <h1>
            WE BRING YOUR
            <br />
            KICKS <em>BACK.</em>
          </h1>
          <p>
            Professional shoe cleaning, repair, and restoration from sneaker specialists who treat every pair like their own.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => setPage('book')}>
              Book an appointment <ArrowRight size={16} />
            </button>
            <button className="text-button" onClick={() => setPage('track')}>
              Track my shoes
            </button>
          </div>
          <div className="social-proof">
            <span className="avatars">A M J</span>
            <span>
              <b>4.9/5</b> from 2,800+ sneakerheads
            </span>
          </div>
        </div>
        <div className="hero-image">
          <div className="quality-card">
            <Check size={16} />
            <span>
              <b>Quality checked</b>
              <small>Every pair. Every time.</small>
            </span>
          </div>
        </div>
      </section>
      <div className="ticker">
        DEEP CLEAN <i /> RESTORATION <i /> SOLE REPAIR <i /> PROTECTION <i /> COLOR REVIVAL <i /> BUILT FOR EVERY PAIR
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BUILT FOR SNEAKERS</span>
            <h2>Sneaker care, done right.</h2>
          </div>
          <button className="text-button" onClick={() => setPage('services')}>
            View all services <ArrowRight size={16} />
          </button>
        </div>
        <div className="services-grid">
          {services.slice(0, 4).map((s) => (
            <ServiceCard key={s.id} service={s} onClick={() => setPage('book')} />
          ))}
        </div>
      </section>
      <section className="standard">
        <div className="standard-image">
          <span>RESTORED</span>
        </div>
        <div className="standard-copy">
          <span className="eyebrow">THE WMK STANDARD</span>
          <h2>
            Results you can see.
            <br />
            Care you can trust.
          </h2>
          <p>
            Every pair goes through a documented multi-step process—from assessment and before photos to final quality control.
          </p>
          <ul>
            <li>Photo-documented service</li>
            <li>Specialist assigned to every pair</li>
            <li>Live status notifications</li>
            <li>Final 5-point quality check</li>
          </ul>
          <button className="primary" onClick={() => setPage('reviews')}>
            See customer results <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="stats">
        {[
          ['12K+', 'PAIRS REVIVED'],
          ['4.9', 'AVERAGE RATING'],
          ['7+', 'METRO BRANCHES'],
          ['96%', 'RETURN CUSTOMERS'],
        ].map(([number, label]) => (
          <div key={label}>
            <b>{number}</b>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <section className="section branch-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">NEAR YOU</span>
            <h2>Find your closest branch.</h2>
            <p>Seven active locations across Metro Manila, Rizal, and Cavite — one consistent standard of care.</p>
          </div>
          <button className="text-button" onClick={() => setPage('branches')}>
            Explore all branches <ArrowRight size={16} />
          </button>
        </div>
        <BranchLocatorMap onBookBranch={onBookBranch} />
      </section>
      <section className="cta">
        <span className="eyebrow">YOUR KICKS DESERVE BETTER</span>
        <h2>Ready for a fresh start?</h2>
        <p>Sign in to your portal and book in under two minutes.</p>
        <button className="primary light" onClick={() => setPage('login')}>
          Log in / Book appointment <ArrowRight size={16} />
        </button>
      </section>
    </>
  )
}

function Listing({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="listing">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children}
    </section>
  )
}

function Services({ setPage }: { setPage: (p: string) => void }) {
  return (
    <Listing eyebrow="OUR SERVICES" title="Care for every kind of kick.">
      <p className="lead">Transparent pricing, expert hands, and progress updates from drop-off to pickup.</p>
      <div className="services-grid full">
        {services.map((s) => (
          <ServiceCard service={s} key={s.id} onClick={() => setPage('login')} />
        ))}
      </div>
    </Listing>
  )
}

function Track({ orders, setPage }: { orders: JobOrder[]; setPage: (p: string) => void }) {
  const [query, setQuery] = useState('WMK-2026-01842')
  const matched = orders.find((o) => o.id.toLowerCase() === query.trim().toLowerCase()) || orders[0]
  return (
    <Listing eyebrow="ORDER TRACKING" title="Know where your kicks are.">
      <p className="lead">Enter your job order number to see the latest update from your assigned specialist.</p>
      <div className="tracking-box">
        <label>
          Job order number
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. WMK-2026-01842" />
        </label>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <b>{matched.id} — {matched.shoe}</b>
            <StatusBadge status={matched.status} />
          </div>
          <p style={{ margin: '6px 0 12px', fontSize: 12 }}>
            {matched.service} · {matched.branch} · Specialist: {matched.specialist}
          </p>
          <ServiceStatusTimeline currentStatus={matched.status} />
        </div>
        <button className="primary" onClick={() => setPage('login-customer')}>
          Sign in to Customer Portal for full tracking <ArrowRight size={16} />
        </button>
        <p>
          Don't have an order yet? <button onClick={() => setPage('login')}>Book an appointment</button>
        </p>
      </div>
    </Listing>
  )
}

function Branches({
  onBookBranch,
}: {
  onBookBranch: (branchName: string, branchId: number) => void
}) {
  return (
    <Listing eyebrow="OUR LOCATIONS" title="Care that’s close to home.">
      <p className="lead">
        Locate the nearest WashMyKicks branch in real time, switch between Satellite, Hybrid, and Standard views, and book directly.
      </p>
      <div style={{ marginBottom: 40 }}>
        <BranchLocatorMap onBookBranch={onBookBranch} />
      </div>
      <div className="branch-cards">
        {wizardBranches.map((branch, i) => (
          <article key={branch.id}>
            <span>0{i + 1}</span>
            <h3>{branch.name}</h3>
            <p>{branch.address}</p>
            <p>Open daily · 10:00 AM – 8:00 PM</p>
            <button
              disabled={branch.comingSoon}
              onClick={() => !branch.comingSoon && onBookBranch(branch.name, branch.id)}
            >
              {branch.comingSoon ? 'Coming Soon' : 'Book Appointment'} <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
    </Listing>
  )
}

function Reviews({ reviews }: { reviews: ReviewItem[] }) {
  return (
    <Listing eyebrow="CUSTOMER STORIES" title="The results speak loud.">
      <div className="review-grid">
        {reviews.map((r) => (
          <article key={r.id}>
            <div>
              {Array.from({ length: r.rating }).map((_, x) => (
                <Star fill="currentColor" key={x} size={15} />
              ))}
            </div>
            <blockquote>“{r.quote}”</blockquote>
            <p>
              {r.author} · {r.service} ({r.branch.replace('Wash My Kicks – ', '')})
            </p>
          </article>
        ))}
      </div>
    </Listing>
  )
}

function About() {
  return (
    <Listing eyebrow="ABOUT WASHMYKICKS" title="Built by sneakerheads, for sneakerheads.">
      <p className="lead">
        We started with a simple belief: every pair deserves skilled, careful work. Today, our specialists combine proven
        methods with a customer experience that keeps every step clear.
      </p>
      <div className="about-strip">
        <div>
          <b>12K+</b>
          <span>pairs revived</span>
        </div>
        <div>
          <b>7</b>
          <span>active branches</span>
        </div>
        <div>
          <b>4.9/5</b>
          <span>customer rating</span>
        </div>
      </div>
    </Listing>
  )
}

/* ============================================================================
   SCREEN 1: ACCOUNT SELECTION PAGE
   ============================================================================ */

function AccountSelectionPage({ setPage }: { setPage: (page: string) => void }) {
  const [forgotModal, setForgotModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const cards = [
    {
      id: 'customer' as Role,
      tag: 'CUSTOMER PORTAL',
      title: 'Customer Portal',
      icon: <User size={26} />,
      description:
        'Book appointments, track shoe orders, receive notifications, manage service history, and submit reviews.',
      buttonText: 'Continue as Customer',
    },
    {
      id: 'staff' as Role,
      tag: 'STAFF PORTAL',
      title: 'Staff Portal',
      icon: <Briefcase size={26} />,
      description:
        'Manage job orders, perform shoe assessments, upload documentation, update service progress, and manage assigned tasks.',
      buttonText: 'Continue as Staff',
    },
    {
      id: 'admin' as Role,
      tag: 'ADMINISTRATOR PORTAL',
      title: 'Administrator Portal',
      icon: <Shield size={26} />,
      description:
        'Manage branches, monitor inventory, view reports, oversee staff activities, and control system settings.',
      buttonText: 'Continue as Administrator',
    },
  ]

  return (
    <Listing eyebrow="ROLE-BASED LOGIN SYSTEM" title="Welcome to WashMyKicks">
      <p className="lead">Choose how you want to access the system.</p>

      <div className="portal-grid">
        {cards.map((card) => (
          <article
            key={card.id}
            className="portal-card"
            onClick={() => setPage(`login-${card.id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setPage(`login-${card.id}`)
            }}
          >
            <div className="portal-icon-box">{card.icon}</div>
            <span className="eyebrow">{card.tag}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <button
              type="button"
              className="primary"
              onClick={(e) => {
                e.stopPropagation()
                setPage(`login-${card.id}`)
              }}
            >
              {card.buttonText} <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>

      <div className="portal-links">
        <button type="button" onClick={() => setPage('home')}>
          ← Back to Home
        </button>
        <button
          type="button"
          onClick={() => {
            setResetSent(false)
            setForgotModal(true)
          }}
        >
          Forgot Password
        </button>
      </div>

      {forgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setForgotModal(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="eyebrow">ACCOUNT RECOVERY</span>
            <h3 style={{ fontSize: 22, margin: '8px 0 8px' }}>Reset your password</h3>
            {resetSent ? (
              <>
                <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
                  Password reset instructions have been sent to <b>{resetEmail || 'your email'}</b>.
                </p>
                <button className="primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => setForgotModal(false)}>
                  Back to Account Selection
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setResetSent(true)
                }}
              >
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                  Enter your registered email address and we'll send a recovery link.
                </p>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@washmykicks.com"
                  style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 16 }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="outline" style={{ flex: 1 }} onClick={() => setForgotModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary" style={{ flex: 1, justifyContent: 'center' }}>
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Listing>
  )
}

/* ============================================================================
   ROLE-SPECIFIC LOGIN PAGES (CUSTOMER, STAFF, ADMIN)
   ============================================================================ */

function RoleLogin({
  role,
  setPage,
  onLoginSuccess,
}: {
  role: Role
  setPage: (page: string) => void
  onLoginSuccess: (role: Role, meta: { email: string; employeeId?: string; branch?: string; name?: string }) => void
}) {
  const isCustomer = role === 'customer'
  const isStaff = role === 'staff'
  const isAdmin = role === 'admin'

  const [email, setEmail] = useState(
    isCustomer ? 'juan.delacruz@email.com' : isStaff ? 'carlo.mendoza@washmykicks.com' : 'admin@washmykicks.com'
  )
  const [password, setPassword] = useState('••••••••••••')
  const [employeeId, setEmployeeId] = useState('WMK-EMP-0104')
  const [branch, setBranch] = useState(staffBranches[0])
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [fullName, setFullName] = useState('Juan Dela Cruz')
  const [forgotMessage, setForgotMessage] = useState('')

  const roleLabel = isAdmin ? 'Administrator' : isStaff ? 'Staff' : 'Customer'
  const perms = RBAC_PERMISSIONS[role]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const roleEnum = isAdmin ? 'ADMINISTRATOR' : isStaff ? 'STAFF' : 'CUSTOMER'
      if (isCustomer && isCreatingAccount) {
        const parts = fullName.trim().split(' ')
        await registerCustomerAccount({
          email,
          password,
          firstName: parts[0] || 'Customer',
          lastName: parts.slice(1).join(' ') || 'User',
        }).catch(() => null)
      } else {
        await signInWithRole({
          email,
          password,
          expectedRole: roleEnum,
        }).catch(() => null)
      }
      onLoginSuccess(role, {
        email,
        employeeId: isStaff ? employeeId : undefined,
        branch: isStaff ? branch : undefined,
        name: isCustomer ? fullName : isStaff ? 'Carlo Mendoza' : 'Mika Cruz',
      })
    } catch (err: any) {
      setForgotMessage(err?.message || 'Unable to sign in.')
    }
  }

  return (
    <section className="auth-screen">
      <div className="auth-story">
        <Brand onClick={() => setPage('home')} />
        <div>
          <span className="eyebrow">{roleLabel.toUpperCase()} PORTAL ACCESS</span>
          <h1>
            Every pair has a story.
            <br />
            We keep it moving.
          </h1>
          <p>
            Connected sneaker care workflows across all WashMyKicks branches—from booking and assessment to final pickup.
          </p>
        </div>
        <div className="auth-rbac-preview">
          <h4>Role-Based Access Control ({roleLabel})</h4>
          <div className="auth-rbac-list">
            {perms.allowed.map((item) => (
              <span key={item} className="auth-rbac-chip">
                <Check size={12} color="#22c55e" /> {item}
              </span>
            ))}
          </div>
          {perms.restricted.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
              Restricted modules: {perms.restricted.join(' · ')}
            </div>
          )}
        </div>
      </div>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <button type="button" className="back-link" onClick={() => setPage('login')}>
            <ArrowLeft size={14} /> Back to Account Selection
          </button>

          <span className="eyebrow">{roleLabel.toUpperCase()} LOGIN</span>
          <h1>{isCreatingAccount && isCustomer ? 'Create Customer Account' : `${roleLabel} Login`}</h1>
          <p>
            {isCustomer
              ? isCreatingAccount
                ? 'Register your WashMyKicks customer profile to book and track shoe orders.'
                : 'Sign in to book appointments, track your kicks, and view service history.'
              : isStaff
              ? 'Sign in with your Employee ID and assigned branch credentials.'
              : 'Sign in with your administrator credentials to manage branches, inventory, and reports.'}
          </p>

          {forgotMessage && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              {forgotMessage}
            </div>
          )}

          {isCustomer && isCreatingAccount && (
            <label>
              Full Name
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
            </label>
          )}

          {isStaff && (
            <>
              <label>
                Employee ID
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="WMK-EMP-0104"
                />
              </label>

              <label>
                Branch Dropdown
                <select value={branch} onChange={(e) => setBranch(e.target.value)} required>
                  {staffBranches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label>
            {isAdmin ? 'Administrator Email' : 'Email Address'}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isAdmin ? 'admin@washmykicks.com' : 'you@email.com'}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </label>

          <button type="submit" className="primary auth-submit">
            {isCustomer && isCreatingAccount ? 'Create Account & Continue' : 'Login'} <ArrowRight size={16} />
          </button>

          {isCustomer && (
            <button
              type="button"
              className="outline auth-submit"
              onClick={() =>
                onLoginSuccess('customer', {
                  email: 'juan.google@gmail.com',
                  name: 'Juan Dela Cruz',
                })
              }
            >
              <Sparkles size={15} color="#dc2626" /> Continue with Google
            </button>
          )}

          {isCustomer ? (
            <div className="auth-links-row">
              <button
                type="button"
                onClick={() => setForgotMessage(`Password reset link sent to ${email || 'your email address'}.`)}
              >
                Forgot Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingAccount(!isCreatingAccount)
                  setForgotMessage('')
                }}
              >
                {isCreatingAccount ? 'Already have an account? Login' : 'Create Account'}
              </button>
            </div>
          ) : (
            <div className="auth-links-row" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setForgotMessage(`Recovery instructions sent to ${email}.`)}
              >
                Forgot Password?
              </button>
            </div>
          )}
        </form>
      </div>
    </section>
  )
}

/* ============================================================================
   CUSTOMER 5-STEP BOOK APPOINTMENT WIZARD (MATCHING UPLOADED SCREENSHOTS)
   ============================================================================ */

function CustomerBookAppointmentWizard({
  initialBranchId = 1,
  preselectedFromMap = false,
  onCompleteBooking,
  onCancel,
}: {
  initialBranchId?: number
  preselectedFromMap?: boolean
  onCompleteBooking: (newOrder: JobOrder) => void
  onCancel: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('02') // Deep Cleaning default like screenshot
  const [calendarYear, setCalendarYear] = useState<number>(2026)
  const [calendarMonth, setCalendarMonth] = useState<number>(2) // 0=Jan, 2=March default
  const [selectedDay, setSelectedDay] = useState<number>(28)
  const [selectedTime, setSelectedTime] = useState<string>('10:30 AM')
  const [shoeModel, setShoeModel] = useState<string>('Air Jordan 1 Retro High')

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const currentMonthName = monthNames[calendarMonth]
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay()
  const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate()
  const prevMonthTrailingDays = Array.from(
    { length: firstDayOfWeek },
    (_, idx) => daysInPrevMonth - firstDayOfWeek + idx + 1
  )
  const activeSelectedDay = Math.min(selectedDay, daysInMonth)

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11)
      setCalendarYear((y) => y - 1)
    } else {
      setCalendarMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0)
      setCalendarYear((y) => y + 1)
    } else {
      setCalendarMonth((m) => m + 1)
    }
  }

  useEffect(() => {
    setSelectedBranchId(initialBranchId)
  }, [initialBranchId])

  const selectedBranch = wizardBranches.find((b) => b.id === selectedBranchId) || wizardBranches[0]
  const selectedService = services.find((s) => s.id === selectedServiceId) || services[1]

  const steps = [
    { num: 1, label: 'Branch' },
    { num: 2, label: 'Service' },
    { num: 3, label: 'Date' },
    { num: 4, label: 'Schedule' },
    { num: 5, label: 'Confirm' },
  ] as const

  const timeSlots = [
    '10:00 AM',
    '10:30 AM',
    '11:30 AM',
    '01:00 PM',
    '02:30 PM',
    '04:00 PM',
    '05:30 PM',
    '06:30 PM',
  ]

  const handleConfirm = () => {
    const formattedDate = `${currentMonthName} ${activeSelectedDay}, ${calendarYear}`
    const numericPrice = Number(selectedService.price.replace(/[^0-9.]/g, '')) || 650
    const scheduledIso = new Date(calendarYear, calendarMonth, activeSelectedDay, 10, 30).toISOString()

    void createBookingRecord({
      customerId: 1,
      branchServiceId: selectedBranch.id,
      scheduledAt: scheduledIso,
      priceAtBooking: numericPrice,
      customerRequest: `${shoeModel || 'Sneaker Pair'} — ${selectedService.title} (${selectedTime})`,
      customerEmail: 'juan.delacruz@email.com',
      customerName: 'Juan Dela Cruz',
      serviceName: selectedService.title,
      branchName: selectedBranch.name,
    }).catch(() => null)

    const newOrder: JobOrder = {
      id: `WMK-${calendarYear}-${Math.floor(1850 + Math.random() * 900)}`,
      customer: 'Juan Dela Cruz',
      email: 'juan.delacruz@email.com',
      shoe: shoeModel || 'Sneaker Pair',
      service: selectedService.title,
      branch: selectedBranch.name,
      date: formattedDate,
      time: selectedTime,
      price: selectedService.price.replace('From ', ''),
      status: 'Pending Assessment',
      stageIndex: 1,
      specialist: 'Carlo Mendoza',
      assessed: false,
      docs: createDefaultDocumentation(),
    }
    onCompleteBooking(newOrder)
  }

  return (
    <div>
      <div className="breadcrumb">
        <button type="button" onClick={onCancel}>
          Dashboard
        </button>
        <span>&gt;</span>
        <span>Book an appointment</span>
      </div>
      <span className="eyebrow">SHOE BOOKING MANAGEMENT MODULE</span>
      <h1>Book an appointment</h1>
      <p>Schedule your pair in five simple steps.</p>

      {preselectedFromMap && (
        <div
          style={{
            maxWidth: 780,
            margin: '0 auto 18px',
            padding: '12px 18px',
            borderRadius: 12,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: 12.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>
            ✓ Branch pre-selected from Branch Locator: <b>{selectedBranch.name}</b>
          </span>
          {step === 1 && (
            <button
              type="button"
              className="primary"
              style={{ padding: '7px 13px', fontSize: 11.5 }}
              onClick={() => setStep(2)}
            >
              Continue with {selectedBranch.name.replace('Wash My Kicks – ', '')} <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* 5-step horizontal stepper matching screenshots */}
      <div className="stepper-bar">
        {steps.map((s, idx) => {
          const isDone = step > s.num
          const isActive = step === s.num
          return (
            <React.Fragment key={s.num}>
              <button
                type="button"
                onClick={() => {
                  if (s.num <= step) setStep(s.num)
                }}
                className={`stepper-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
              >
                <span className="stepper-circle">{isDone ? <Check size={13} /> : s.num}</span>
                <span>{s.label}</span>
              </button>
              {idx < steps.length - 1 && <div className={`stepper-line ${step > s.num ? 'done' : ''}`} />}
            </React.Fragment>
          )
        })}
      </div>

      {/* STEP 1: CHOOSE A BRANCH */}
      {step === 1 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 1 OF 5</span>
            <h2>Choose a branch</h2>
            <p>Where would you like to drop off your pair?</p>
          </div>

          <div className="wizard-grid-2">
            {wizardBranches.map((b) => {
              const isSelected = selectedBranchId === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={b.comingSoon}
                  className={`choice-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedBranchId(b.id)}
                >
                  <span className="choice-num">{b.id}</span>
                  <span className="choice-body">
                    <b>{b.name}</b>
                    <small>{b.address}</small>
                    {b.comingSoon && <span className="price-tag">COMING SOON</span>}
                  </span>
                  {isSelected && <Check size={16} className="choice-check" />}
                </button>
              )
            })}
          </div>

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={onCancel}>
              ← Cancel
            </button>
            <button type="button" className="primary" onClick={() => setStep(2)}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SELECT YOUR SERVICE */}
      {step === 2 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 2 OF 5</span>
            <h2>Select your service</h2>
            <p>What does your pair need?</p>
          </div>

          <div className="wizard-grid-2">
            {services.map((s) => {
              const isSelected = selectedServiceId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`choice-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedServiceId(s.id)}
                >
                  <span style={{ color: '#dc2626', flexShrink: 0 }}>
                    <ShieldCheck size={20} />
                  </span>
                  <span className="choice-body">
                    <b>{s.title}</b>
                    <small>{s.copy}</small>
                    <span className="price-tag">
                      {s.price} · {s.duration}
                    </span>
                  </span>
                  {isSelected && <Check size={16} className="choice-check" />}
                </button>
              )
            })}
          </div>

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button type="button" className="primary" onClick={() => setStep(3)}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CHOOSE A DATE */}
      {step === 3 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 3 OF 5</span>
            <h2>Choose a date</h2>
            <p>Select your preferred drop-off date.</p>
          </div>

          <div className="calendar-box">
            <div className="calendar-nav">
              <button type="button" aria-label="Previous month" onClick={handlePrevMonth}>
                <ChevronLeft size={14} />
              </button>
              <b>
                {currentMonthName} {calendarYear}
              </b>
              <button type="button" aria-label="Next month" onClick={handleNextMonth}>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="calendar-grid">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                <div key={d} className="calendar-dow">
                  {d}
                </div>
              ))}
              {prevMonthTrailingDays.map((d) => (
                <button key={`prev-${d}`} type="button" disabled className="calendar-day muted">
                  {d}
                </button>
              ))}
              {Array.from({ length: daysInMonth }, (_, idx) => idx + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`calendar-day ${activeSelectedDay === day ? 'selected' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={() => setStep(2)}>
              ← Back
            </button>
            <button type="button" className="primary" onClick={() => setStep(4)}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SCHEDULE & SHOE PAIR DETAILS */}
      {step === 4 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 4 OF 5</span>
            <h2>Select a schedule</h2>
            <p>
              Pick your preferred time slot on {currentMonthName} {activeSelectedDay}, {calendarYear}.
            </p>
          </div>

          <div className="wizard-grid-2" style={{ marginBottom: 20 }}>
            {timeSlots.map((slot) => {
              const isSelected = selectedTime === slot
              return (
                <button
                  key={slot}
                  type="button"
                  className={`choice-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedTime(slot)}
                >
                  <Clock3 size={18} color="#dc2626" />
                  <span className="choice-body">
                    <b>{slot}</b>
                    <small>Available drop-off slot</small>
                  </span>
                  {isSelected && <Check size={16} className="choice-check" />}
                </button>
              )
            })}
          </div>

          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Sneaker Brand & Model
            </label>
            <input
              type="text"
              value={shoeModel}
              onChange={(e) => setShoeModel(e.target.value)}
              placeholder="e.g. Air Jordan 1 Retro High"
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #d1d5db',
                borderRadius: 10,
                fontSize: 13,
              }}
            />
          </div>

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={() => setStep(3)}>
              ← Back
            </button>
            <button type="button" className="primary" onClick={() => setStep(5)}>
              Continue <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: CONFIRM YOUR BOOKING */}
      {step === 5 && (
        <div className="wizard-card">
          <div className="wizard-header">
            <span className="step-tag">STEP 5 OF 5</span>
            <h2>Confirm your booking</h2>
            <p>Review the details before confirming.</p>
          </div>

          <div className="confirm-list">
            <div className="confirm-item">
              <div className="confirm-icon">
                <MapPin size={18} />
              </div>
              <div className="confirm-text">
                <span>BRANCH</span>
                <b>{selectedBranch.name}</b>
                <small>{selectedBranch.address}</small>
              </div>
              <button type="button" className="confirm-change" onClick={() => setStep(1)}>
                Change
              </button>
            </div>

            <div className="confirm-item">
              <div className="confirm-icon">
                <Sparkles size={18} />
              </div>
              <div className="confirm-text">
                <span>SERVICE</span>
                <b>{selectedService.title}</b>
                <small>Estimated service time: {selectedService.duration}</small>
              </div>
              <button type="button" className="confirm-change" onClick={() => setStep(2)}>
                Change
              </button>
            </div>

            <div className="confirm-item">
              <div className="confirm-icon">
                <Calendar size={18} />
              </div>
              <div className="confirm-text">
                <span>DROP-OFF</span>
                <b>
                  {currentMonthName} {activeSelectedDay}, {calendarYear} · {selectedTime}
                </b>
                <small>Selected appointment date · {shoeModel}</small>
              </div>
              <button type="button" className="confirm-change" onClick={() => setStep(3)}>
                Change
              </button>
            </div>

            <div className="confirm-total-bar">
              <div>
                <span>ESTIMATED TOTAL</span>
                <small>Pay at branch after assessment</small>
              </div>
              <b>{selectedService.price.replace('From ', '')}</b>
            </div>
          </div>

          <div className="wizard-footer">
            <button type="button" className="wizard-back" onClick={() => setStep(4)}>
              ← Back
            </button>
            <button type="button" className="primary" onClick={handleConfirm}>
              Confirm appointment <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   CUSTOMER DASHBOARD FLOW
   ============================================================================ */

function CustomerDashboard({
  userMeta,
  orders,
  setOrders,
  reviews,
  setReviews,
  setPage,
  onLogout,
  initialTab = 'Dashboard',
  preselectedBranchId = 1,
  preselectedFromMap = false,
}: {
  userMeta: { name: string; email: string }
  orders: JobOrder[]
  setOrders: React.Dispatch<React.SetStateAction<JobOrder[]>>
  reviews: ReviewItem[]
  setReviews: React.Dispatch<React.SetStateAction<ReviewItem[]>>
  setPage: (p: string) => void
  onLogout: () => void
  initialTab?: 'Dashboard' | 'Book Appointment' | 'Track Shoes' | 'Notifications' | 'Service History' | 'Reviews' | 'Profile'
  preselectedBranchId?: number
  preselectedFromMap?: boolean
}) {
  const [tab, setTab] = useState<
    'Dashboard' | 'Book Appointment' | 'Track Shoes' | 'Notifications' | 'Service History' | 'Reviews' | 'Profile'
  >(initialTab)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || 'WMK-2026-01842')

  // Review form state
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewService, setReviewService] = useState('Deep Cleaning')
  const [reviewBranch, setReviewBranch] = useState(staffBranches[0])
  const [reviewQuote, setReviewQuote] = useState('')

  // Profile form state
  const [profileName, setProfileName] = useState(userMeta.name)
  const [profileEmail, setProfileEmail] = useState(userMeta.email)
  const [profilePhone, setProfilePhone] = useState('+63 917 555 0192')
  const [profileBranch, setProfileBranch] = useState(staffBranches[0])

  const customerOrders = orders
  const activeOrders = customerOrders.filter((o) => o.status !== 'Completed')
  const completedOrders = customerOrders.filter((o) => o.status === 'Completed')
  const trackedOrder = customerOrders.find((o) => o.id === selectedOrderId) || customerOrders[0]

  const sidebarItems: {
    key: typeof tab
    icon: React.ReactNode
    badge?: number
  }[] = [
    { key: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { key: 'Book Appointment', icon: <Calendar size={17} /> },
    { key: 'Track Shoes', icon: <Package size={17} /> },
    { key: 'Notifications', icon: <Bell size={17} />, badge: 3 },
    { key: 'Service History', icon: <History size={17} /> },
    { key: 'Reviews', icon: <Star size={17} /> },
    { key: 'Profile', icon: <User size={17} /> },
  ]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  return (
    <section className="dashboard">
      <aside className="sidebar dark-sidebar">
        <Brand onClick={() => setPage('home')} />
        <span className="portal-label">CUSTOMER PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            <span>{item.key}</span>
            {item.badge && <span className="sidebar-badge">{item.badge}</span>}
          </button>
        ))}
        <button type="button" className="sidebar-btn" onClick={() => setPage('home')}>
          <ArrowLeft size={17} />
          <span>Public Homepage</span>
        </button>
        <button type="button" className="sidebar-btn logout" onClick={onLogout}>
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-search">
            <Search size={15} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your orders..."
            />
          </div>
          <div className="dash-user">
            <button type="button" className="dash-bell-btn" onClick={() => setTab('Notifications')}>
              <Bell size={17} />
              <span className="badge-dot">3</span>
            </button>
            <div className="dash-avatar">JD</div>
            <div className="dash-user-info">
              <b>{profileName}</b>
              <small>Customer · San Juan</small>
            </div>
          </div>
        </header>

        <main className="dash-content">
          {toast && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '12px 18px',
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>✓ {toast}</span>
              <button type="button" onClick={() => setToast('')}>
                <X size={15} />
              </button>
            </div>
          )}

          {/* TAB 1: CUSTOMER DASHBOARD OVERVIEW */}
          {tab === 'Dashboard' && (
            <>
              <div className="wmk-breadcrumb">
                <b>Dashboard</b> &gt; Good morning, {profileName.split(' ')[0]}.
              </div>
              <span className="eyebrow">CUSTOMER PORTAL</span>
              <h1>Good morning, {profileName.split(' ')[0]}.</h1>
              <p>San Juan City branch · Tuesday, March 24</p>

              {/* Row 1: 4 Icon KPI Stat Cards */}
              <div className="wmk-inv-kpi-grid">
                <div className="wmk-inv-kpi-card" onClick={() => setTab('Track Shoes')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Package size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Current Orders</span>
                    <b>{activeOrders.length} orders</b>
                    <small>1 in active care</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Book Appointment')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon red">
                    <Clock3 size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Upcoming Appointments</span>
                    <b>Mar 28</b>
                    <small>10:30 AM · San Juan</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Service History')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon green">
                    <Check size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Completed Services</span>
                    <b>{completedOrders.length + 11} pairs</b>
                    <small>100% quality checked</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Notifications')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Bell size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Recent Notifications</span>
                    <b>3 unread</b>
                    <small>Needs attention</small>
                  </div>
                </div>
              </div>

              {/* Row 2: Horizontal Quick Actions Banner */}
              <div className="wmk-action-banner">
                <div>
                  <span className="eyebrow">CUSTOMER ACTIONS</span>
                  <h3>Continue your sneaker care workflow.</h3>
                </div>
                <div className="wmk-action-banner-btns">
                  <button type="button" className="primary" onClick={() => setTab('Book Appointment')}>
                    <Calendar size={15} /> Book Appointment
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Track Shoes')}>
                    <Package size={15} /> Track Order
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Reviews')}>
                    <Star size={15} /> Leave Review
                  </button>
                </div>
              </div>

              {/* Row 3: 2-Column Split (Priority Queue + Order Updates) */}
              <div className="wmk-dash-split">
                <div className="wmk-queue-card">
                  <div className="wmk-queue-head">
                    <div>
                      <span className="eyebrow">MY SHOE ORDERS</span>
                      <h3>Active &amp; recent queue</h3>
                    </div>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Track Shoes')}>
                      View all
                    </button>
                  </div>

                  <table className="wmk-queue-table">
                    <thead>
                      <tr>
                        <th>Job order</th>
                        <th>Customer</th>
                        <th>Shoe</th>
                        <th>Service</th>
                        <th>Branch</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOrders.slice(0, 5).map((o, idx) => (
                        <tr key={o.id}>
                          <td>
                            <b>{o.id}</b>
                          </td>
                          <td>{o.customer}</td>
                          <td>{o.shoe.split('·')[0]}</td>
                          <td>{o.service}</td>
                          <td>{o.branch.replace('Wash My Kicks – ', '')}</td>
                          <td>
                            <span className={`wmk-priority-tag ${idx === 0 ? 'high' : 'normal'}`}>
                              {idx === 0 ? 'High' : 'Normal'}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={o.status} />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="wmk-dots-btn"
                              onClick={() => setTab('Track Shoes')}
                              title="Track order"
                            >
                              •••
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="wmk-updates-card">
                  <div className="wmk-updates-head">
                    <h3>Order updates</h3>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Notifications')}>
                      View all
                    </button>
                  </div>

                  <div className="wmk-update-list">
                    <div className="wmk-update-item" onClick={() => setTab('Track Shoes')}>
                      <div className="wmk-update-icon">
                        <Sparkles size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>Cleaning in progress</b>
                        <span>WMK-2026-01842 · 8 min ago</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>

                    <div className="wmk-update-item" onClick={() => setTab('Book Appointment')}>
                      <div className="wmk-update-icon">
                        <Camera size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>Intake photos uploaded</b>
                        <span>WMK-2026-01842 · Today</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>

                    <div className="wmk-update-item" onClick={() => setTab('Reviews')}>
                      <div className="wmk-update-icon">
                        <Check size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>Order completed</b>
                        <span>WMK-2026-01790 · Yesterday</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: BOOK APPOINTMENT (5-STEP WIZARD FROM SCREENSHOTS) */}
          {tab === 'Book Appointment' && (
            <CustomerBookAppointmentWizard
              initialBranchId={preselectedBranchId}
              preselectedFromMap={preselectedFromMap}
              onCancel={() => setTab('Dashboard')}
              onCompleteBooking={(newOrder) => {
                setOrders((prev) => [newOrder, ...prev])
                setSelectedOrderId(newOrder.id)
                void createBookingRecord({
                  customerId: 1,
                  branchServiceId: 1,
                  scheduledAt: new Date().toISOString(),
                  priceAtBooking: Number(newOrder.price.replace(/[^\d.]/g, '')) || 650,
                  customerRequest: `${newOrder.shoe} — ${newOrder.service}`,
                  customerEmail: newOrder.email,
                  customerName: newOrder.customer,
                  serviceName: newOrder.service,
                  branchName: newOrder.branch,
                }).catch(() => null)
                showToast(`Appointment confirmed! Job Order ${newOrder.id} created for ${newOrder.date} at ${newOrder.time}.`)
                setTab('Track Shoes')
              }}
            />
          )}

          {/* TAB 3: TRACK SHOES / ORDER TRACKING */}
          {tab === 'Track Shoes' && (
            <>
              <span className="eyebrow">LIVE ORDER TRACKING</span>
              <h1>Track Shoes</h1>
              <p>Real-time status updates and specialist documentation for your pairs.</p>

              <div className="dash-panel">
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  {customerOrders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={trackedOrder.id === o.id ? 'primary' : 'outline'}
                      onClick={() => setSelectedOrderId(o.id)}
                    >
                      {o.id} · {o.shoe}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <span className="eyebrow">{trackedOrder.id}</span>
                    <h2>{trackedOrder.shoe}</h2>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                      Service: <b>{trackedOrder.service}</b> · Branch: <b>{trackedOrder.branch}</b> · Drop-off: {trackedOrder.date} ({trackedOrder.time})
                    </p>
                  </div>
                  <StatusBadge status={trackedOrder.status} />
                </div>

                <ServiceStatusTimeline currentStatus={trackedOrder.status} />

                {trackedOrder.assessmentNotes && (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginTop: 14 }}>
                    <b style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      Specialist Assessment Notes ({trackedOrder.specialist}):
                    </b>
                    <p style={{ fontSize: 12.5, color: '#4b5563', margin: 0 }}>{trackedOrder.assessmentNotes}</p>
                  </div>
                )}

                <div className="dash-actions">
                  <button type="button" className="primary" onClick={() => setTab('Reviews')}>
                    Proceed to Leave Feedback / Review <ArrowRight size={15} />
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Book Appointment')}>
                    Book Another Pair
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {tab === 'Notifications' && (
            <>
              <span className="eyebrow">ALERTS & UPDATES</span>
              <h1>Notifications</h1>
              <p>Stay updated on assessments, cleaning milestones, and pickup readiness.</p>

              <div className="dash-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  {
                    title: 'Deep Cleaning in Progress — WMK-2026-01842',
                    body: 'Specialist Carlo Mendoza completed midsole de-yellowing on your Air Jordan 1 Retro High.',
                    time: '25 minutes ago',
                    unread: true,
                  },
                  {
                    title: 'Shoe Assessment Approved — WMK-2026-01842',
                    body: 'Initial inspection and before-service photos have been uploaded to your order record.',
                    time: '3 hours ago',
                    unread: true,
                  },
                  {
                    title: 'Appointment Reminder — San Juan City Branch',
                    body: 'Your upcoming drop-off is scheduled for March 28, 2026 at 10:30 AM.',
                    time: '1 day ago',
                    unread: true,
                  },
                ].map((n, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      border: '1px solid #e5e7eb',
                      background: n.unread ? '#fffbfb' : '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    <div>
                      <b style={{ fontSize: 13.5, display: 'block', marginBottom: 4 }}>{n.title}</b>
                      <p style={{ fontSize: 12.5, color: '#6b7280', margin: 0 }}>{n.body}</p>
                      <small style={{ fontSize: 11, color: '#9ca3af' }}>{n.time}</small>
                    </div>
                    <button type="button" className="outline" onClick={() => setTab('Track Shoes')}>
                      View Order
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TAB 5: SERVICE HISTORY */}
          {tab === 'Service History' && (
            <>
              <span className="eyebrow">PAST & CURRENT CARE</span>
              <h1>Service History</h1>
              <p>Complete archive of all your sneaker care sessions with WashMyKicks.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Order</th>
                      <th>Sneaker Pair</th>
                      <th>Service</th>
                      <th>Branch</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.id}</b>
                        </td>
                        <td>{o.shoe}</td>
                        <td>{o.service}</td>
                        <td>{o.branch}</td>
                        <td>{o.date}</td>
                        <td>
                          <b>{o.price}</b>
                        </td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="confirm-change"
                            onClick={() => {
                              setSelectedOrderId(o.id)
                              setTab('Track Shoes')
                            }}
                          >
                            Track / View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 6: REVIEWS / FEEDBACK */}
          {tab === 'Reviews' && (
            <>
              <span className="eyebrow">CUSTOMER FEEDBACK</span>
              <h1>Reviews</h1>
              <p>Share your experience with our sneaker specialists.</p>

              <div className="wizard-grid-2" style={{ alignItems: 'start' }}>
                <form
                  className="dash-panel"
                  style={{ marginTop: 0 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!reviewQuote.trim()) return
                    void submitCustomerCrmInteraction({
                      customerId: 1,
                      interactionType: 'REVIEW',
                      customerMessage: reviewQuote,
                      rating: reviewRating,
                    }).catch(() => null)
                    setReviews((prev) => [
                      {
                        id: `r-${Date.now()}`,
                        author: profileName,
                        service: reviewService,
                        branch: reviewBranch,
                        rating: reviewRating,
                        quote: reviewQuote,
                        date: 'March 28, 2026',
                      },
                      ...prev,
                    ])
                    setReviewQuote('')
                    showToast('Thank you! Your review has been published.')
                  }}
                >
                  <span className="eyebrow">SUBMIT FEEDBACK</span>
                  <h2>Leave a Review</h2>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
                    Star Rating
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setReviewRating(num)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #e5e7eb',
                          background: reviewRating >= num ? '#fef2f2' : '#fff',
                          color: reviewRating >= num ? '#dc2626' : '#9ca3af',
                          fontWeight: 700,
                        }}
                      >
                        ★ {num}
                      </button>
                    ))}
                  </div>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
                    Service Received
                    <select
                      value={reviewService}
                      onChange={(e) => setReviewService(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.title}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
                    Branch
                    <select
                      value={reviewBranch}
                      onChange={(e) => setReviewBranch(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    >
                      {staffBranches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }}>
                    Your Feedback
                    <textarea
                      required
                      rows={3}
                      value={reviewQuote}
                      onChange={(e) => setReviewQuote(e.target.value)}
                      placeholder="How did your kicks turn out?"
                      style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    />
                  </label>

                  <button type="submit" className="primary" style={{ marginTop: 12 }}>
                    Submit Review <ArrowRight size={15} />
                  </button>
                </form>

                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">RECENT COMMUNITY REVIEWS</span>
                  <h2>Customer Stories</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {reviews.map((r) => (
                      <div key={r.id} style={{ padding: 14, border: '1px solid #f0eeeb', borderRadius: 10 }}>
                        <div style={{ color: '#dc2626', fontSize: 13 }}>{'★'.repeat(r.rating)}</div>
                        <p style={{ fontWeight: 600, fontSize: 13.5, margin: '6px 0' }}>“{r.quote}”</p>
                        <small style={{ color: '#6b7280', fontSize: 11.5 }}>
                          {r.author} · {r.service} · {r.branch}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 7: PROFILE */}
          {tab === 'Profile' && (
            <>
              <span className="eyebrow">ACCOUNT SETTINGS</span>
              <h1>Profile</h1>
              <p>Manage your personal information and preferred drop-off branch.</p>

              <form
                className="dash-panel"
                style={{ maxWidth: 620 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  showToast('Customer profile updated successfully.')
                }}
              >
                <div className="wizard-grid-2">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Full Name
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Email Address
                    <input
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Mobile Number
                    <input
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 700 }}>
                    Preferred Branch
                    <select
                      value={profileBranch}
                      onChange={(e) => setProfileBranch(e.target.value)}
                      style={{ width: '100%', padding: 11, border: '1px solid #d1d5db', borderRadius: 8, marginTop: 6 }}
                    >
                      {staffBranches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="dash-actions">
                  <button type="submit" className="primary">
                    Save Profile Changes
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </section>
  )
}

/* ============================================================================
   STAFF DASHBOARD FLOW
   ============================================================================ */

function StaffDashboard({
  userMeta,
  orders,
  setOrders,
  inventory,
  setInventory,
  onLogout,
}: {
  userMeta: { name: string; email: string; employeeId?: string; branch?: string }
  orders: JobOrder[]
  setOrders: React.Dispatch<React.SetStateAction<JobOrder[]>>
  inventory: InventoryRecord[]
  setInventory: React.Dispatch<React.SetStateAction<InventoryRecord[]>>
  onLogout: () => void
}) {
  const [tab, setTab] = useState<
    | 'Dashboard'
    | 'Job Orders'
    | 'Shoe Assessment'
    | 'Before & After Documentation'
    | 'Assigned Services'
    | 'Inventory'
    | 'Customers'
    | 'Notifications'
  >('Dashboard')
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || 'WMK-2026-0046')
  const [toast, setToast] = useState('')

  const sidebarItems: { key: typeof tab; icon: React.ReactNode; badge?: number }[] = [
    { key: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { key: 'Job Orders', icon: <ClipboardCheck size={17} /> },
    { key: 'Shoe Assessment', icon: <Wrench size={17} /> },
    { key: 'Before & After Documentation', icon: <Camera size={17} /> },
    { key: 'Assigned Services', icon: <Briefcase size={17} /> },
    { key: 'Inventory', icon: <Package size={17} /> },
    { key: 'Customers', icon: <Users size={17} /> },
    { key: 'Notifications', icon: <Bell size={17} />, badge: 3 },
  ]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const updateOrderStatus = (id: string, nextStatus: JobOrder['status']) => {
    const stageMap: Record<JobOrder['status'], number> = {
      'Pending Assessment': 2,
      'In Progress': 3,
      'Quality Check': 4,
      'Ready for Pickup': 5,
      Completed: 5,
    }
    const targetOrder = orders.find((o) => o.id === id)
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: nextStatus, stageIndex: stageMap[nextStatus] } : o))
    )
    void updateServiceOrderStatus({
      orderNumber: id,
      nextStatus,
      customerEmail: targetOrder?.email,
      customerName: targetOrder?.customer,
      serviceName: targetOrder?.service,
      branchName: targetOrder?.branch,
    }).catch(() => null)
    showToast(`Order ${id} status updated to "${nextStatus}".`)
  }

  const handleUploadAnglePhoto = (
    orderId: string,
    angle: ShoeAngleKey,
    side: 'before' | 'after',
    dataUrl: string
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              docs: {
                ...o.docs,
                [angle]: {
                  ...o.docs[angle],
                  [side]: dataUrl,
                },
              },
            }
          : o
      )
    )
    void uploadAssessmentPhotoToStorage({
      branchId: 1,
      orderId: Number(orderId.replace(/\D/g, '')) || 46,
      assessmentId: Number(orderId.replace(/\D/g, '')) || 46,
      side,
      angle,
      fileOrDataUrl: dataUrl,
    }).catch(() => null)
    const angleNames: Record<ShoeAngleKey, string> = {
      left: 'Left side',
      right: 'Right side',
      toe: 'Toe box',
      sole: 'Outsole / Sole',
    }
    showToast(`Uploaded ${angleNames[angle]} (${side.toUpperCase()}) photo for ${orderId}.`)
  }

  return (
    <section className="dashboard">
      <aside className="sidebar dark-sidebar">
        <Brand />
        <span className="portal-label">STAFF PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            <span>{item.key}</span>
            {item.badge && <span className="sidebar-badge">{item.badge}</span>}
          </button>
        ))}
        <button type="button" className="sidebar-btn logout" onClick={onLogout}>
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-search">
            <Search size={15} />
            <input placeholder="Search orders and customers..." />
          </div>
          <div className="dash-user">
            <button type="button" className="dash-bell-btn" onClick={() => setTab('Notifications')}>
              <Bell size={17} />
              <span className="badge-dot">3</span>
            </button>
            <div className="dash-avatar">CM</div>
            <div className="dash-user-info">
              <b>{userMeta.name}</b>
              <small>Staff · {(userMeta.branch || 'Wash My Kicks – San Juan City').replace('Wash My Kicks – ', '')}</small>
            </div>
          </div>
        </header>

        <main className="dash-content">
          {toast && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '12px 18px',
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✓ {toast}
            </div>
          )}

          {/* STAFF DASHBOARD OVERVIEW */}
          {tab === 'Dashboard' && (
            <>
              <div className="wmk-breadcrumb">
                <b>Dashboard</b> &gt; Good morning, {userMeta.name.split(' ')[0]}.
              </div>
              <span className="eyebrow">BRANCH OPERATIONS</span>
              <h1>Good morning, {userMeta.name.split(' ')[0]}.</h1>
              <p>{(userMeta.branch || 'Wash My Kicks – San Juan City').replace('Wash My Kicks – ', '')} branch · Tuesday, March 24</p>

              {/* Row 1: 4 Icon KPI Stat Cards */}
              <div className="wmk-inv-kpi-grid">
                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Package size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Assigned Orders</span>
                    <b>8 orders</b>
                    <small>2 high priority</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Assigned Services')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon red">
                    <Clock3 size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Orders In Progress</span>
                    <b>5 pairs</b>
                    <small>3 due this week</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon green">
                    <Check size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Orders Completed</span>
                    <b>14 pairs</b>
                    <small>This month</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Shoe Assessment')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Sparkles size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Pending Assessments</span>
                    <b>3 pairs</b>
                    <small>Needs attention</small>
                  </div>
                </div>
              </div>

              {/* Row 2: Horizontal Staff Actions Banner */}
              <div className="wmk-action-banner">
                <div>
                  <span className="eyebrow">STAFF ACTIONS</span>
                  <h3>Continue your branch workflow.</h3>
                </div>
                <div className="wmk-action-banner-btns">
                  <button type="button" className="primary" onClick={() => setTab('Shoe Assessment')}>
                    <Sparkles size={15} /> Create Assessment
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Before & After Documentation')}>
                    <Camera size={15} /> Upload Photos
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Assigned Services')}>
                    <SettingsIcon size={15} /> Update Status
                  </button>
                </div>
              </div>

              {/* Row 3: 2-Column Split (Priority Queue + Branch Updates) */}
              <div className="wmk-dash-split">
                <div className="wmk-queue-card">
                  <div className="wmk-queue-head">
                    <div>
                      <span className="eyebrow">MY ASSIGNED ORDERS</span>
                      <h3>Today&apos;s priority queue</h3>
                    </div>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Job Orders')}>
                      View all
                    </button>
                  </div>

                  <table className="wmk-queue-table">
                    <thead>
                      <tr>
                        <th>Job order</th>
                        <th>Customer</th>
                        <th>Shoe</th>
                        <th>Service</th>
                        <th>Branch</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          id: 'WMK-2026-0046',
                          customer: 'Andrea Reyes',
                          shoe: 'Nike Air Max 97',
                          service: 'Restoration',
                          branch: 'San Juan City',
                          priority: 'High',
                          priorityClass: 'high',
                          status: 'In Service',
                        },
                        {
                          id: 'WMK-2026-0045',
                          customer: 'Paolo Tan',
                          shoe: 'Jordan 4',
                          service: 'Deep Cleaning',
                          branch: 'Quezon City',
                          priority: 'Normal',
                          priorityClass: 'normal',
                          status: 'Assessment',
                        },
                        {
                          id: 'WMK-2026-0044',
                          customer: 'Sam Lee',
                          shoe: 'Adidas Samba',
                          service: 'Sole Repair',
                          branch: 'Pasig City',
                          priority: 'Urgent',
                          priorityClass: 'urgent',
                          status: 'Quality Check',
                        },
                        {
                          id: 'WMK-2026-0043',
                          customer: 'Nicole Cruz',
                          shoe: 'New Balance 550',
                          service: 'Basic Clean',
                          branch: 'Pateros',
                          priority: 'Normal',
                          priorityClass: 'normal',
                          status: 'Ready',
                        },
                        {
                          id: 'WMK-2026-0042',
                          customer: 'John Uy',
                          shoe: 'Nike Dunk Low',
                          service: 'Restoration',
                          branch: 'Montalban, Rizal',
                          priority: 'High',
                          priorityClass: 'high',
                          status: 'Received',
                        },
                      ].map((row) => {
                        const liveOrder = orders.find((o) => o.id === row.id)
                        const liveStatus = liveOrder ? liveOrder.status : row.status
                        return (
                          <tr key={row.id}>
                            <td>
                              <b>{row.id}</b>
                            </td>
                            <td>{row.customer}</td>
                            <td>{row.shoe}</td>
                            <td>{row.service}</td>
                            <td>{row.branch}</td>
                            <td>
                              <span className={`wmk-priority-tag ${row.priorityClass}`}>{row.priority}</span>
                            </td>
                            <td>
                              <StatusBadge status={liveStatus} />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="wmk-dots-btn"
                                onClick={() => {
                                  setSelectedOrderId(row.id)
                                  setTab('Shoe Assessment')
                                }}
                                title="Open order actions"
                              >
                                •••
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="wmk-updates-card">
                  <div className="wmk-updates-head">
                    <h3>Branch updates</h3>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Notifications')}>
                      View all
                    </button>
                  </div>

                  <div className="wmk-update-list">
                    <div
                      className="wmk-update-item"
                      onClick={() => {
                        setSelectedOrderId('WMK-2026-0045')
                        setTab('Shoe Assessment')
                      }}
                    >
                      <div className="wmk-update-icon">
                        <Sparkles size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>Assessment requested</b>
                        <span>WMK-2026-0045 · 8 min ago</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>

                    <div
                      className="wmk-update-item"
                      onClick={() => {
                        setSelectedOrderId('WMK-2026-0046')
                        setTab('Before & After Documentation')
                      }}
                    >
                      <div className="wmk-update-icon">
                        <Camera size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>After photos due</b>
                        <span>WMK-2026-0046 · Today</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>

                    <div className="wmk-update-item" onClick={() => setTab('Job Orders')}>
                      <div className="wmk-update-icon">
                        <Check size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>Order completed</b>
                        <span>WMK-2026-0041 · Yesterday</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STAFF TAB: JOB ORDERS */}
          {tab === 'Job Orders' && (
            <>
              <span className="eyebrow">BRANCH QUEUE</span>
              <h1>Job Orders</h1>
              <p>Select a job order to update service progress or proceed to shoe assessment &amp; documentation.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Order</th>
                      <th>Customer</th>
                      <th>Shoe Pair</th>
                      <th>Service</th>
                      <th>Assessed</th>
                      <th>Status</th>
                      <th>Update Status</th>
                      <th>Workflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.id}</b>
                        </td>
                        <td>{o.customer}</td>
                        <td>{o.shoe}</td>
                        <td>{o.service}</td>
                        <td>{o.assessed ? '✔ Yes' : 'Pending'}</td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>
                          <StatusSelect
                            value={o.status}
                            onChange={(next) => updateOrderStatus(o.id, next)}
                          />
                        </td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="outline"
                            style={{ padding: '6px 10px', fontSize: 11 }}
                            onClick={() => {
                              setSelectedOrderId(o.id)
                              setTab('Shoe Assessment')
                            }}
                          >
                            Assess
                          </button>
                          <button
                            type="button"
                            className="primary"
                            style={{ padding: '6px 10px', fontSize: 11 }}
                            onClick={() => {
                              setSelectedOrderId(o.id)
                              setTab('Before & After Documentation')
                            }}
                          >
                            4-Angle Docs <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* STAFF TAB: SHOE ASSESSMENT */}
          {tab === 'Shoe Assessment' && (
            <StaffShoeAssessmentModule
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              onSaveDraft={showToast}
              onUploadIntakePhoto={(orderId, angle, url) =>
                handleUploadAnglePhoto(orderId, angle, 'before', url)
              }
              onCompleteAssessment={(orderId, notes, conditions, shoeLabel) => {
                void upsertShoeAssessmentRecord({
                  orderId: Number(orderId.replace(/\D/g, '')) || 46,
                  shoeCondition: conditions.join(', '),
                  damageFindings: notes,
                  recommendations: 'Restoration + Deep Clean',
                  serviceNotes: notes,
                  assessmentStatus: 'Completed',
                }).catch(() => null)
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === orderId
                      ? {
                          ...o,
                          shoe: shoeLabel || o.shoe,
                          assessed: true,
                          status: 'In Progress',
                          stageIndex: 3,
                          assessmentNotes: notes,
                          conditionTags: conditions,
                        }
                      : o
                  )
                )
                showToast(`Assessment completed for ${orderId}. Order moved to "In Progress".`)
              }}
            />
          )}

          {/* STAFF TAB: BEFORE & AFTER DOCUMENTATION (LEFT SIDE, RIGHT SIDE, TOE, SOLE) */}
          {tab === 'Before & After Documentation' && (
            <BeforeAfterDocumentationModule
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              onUploadAnglePhoto={handleUploadAnglePhoto}
              onUpdateOrderStatus={updateOrderStatus}
              onBackToDashboard={() => setTab('Dashboard')}
            />
          )}

          {/* STAFF TAB: ASSIGNED SERVICES */}
          {tab === 'Assigned Services' && (
            <StaffAssignedServicesModule
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              onSaveStatus={updateOrderStatus}
              onOpenDocumentation={(id) => {
                setSelectedOrderId(id)
                setTab('Before & After Documentation')
              }}
              onBackToDashboard={() => setTab('Dashboard')}
            />
          )}

          {/* STAFF TAB: INVENTORY MANAGEMENT MODULE (RBAC ENABLED) */}
          {tab === 'Inventory' && (
            <InventoryManagementModule
              roleLabel="STAFF"
              branches={staffBranches}
              defaultBranch={userMeta.branch || staffBranches[0]}
              inventory={inventory}
              setInventory={setInventory}
              onBackToDashboard={() => setTab('Dashboard')}
              onNotify={showToast}
            />
          )}

          {/* STAFF TAB: CUSTOMERS */}
          {tab === 'Customers' && (
            <>
              <span className="eyebrow">BRANCH DIRECTORY</span>
              <h1>Customers</h1>
              <p>Customers with active or recent shoe orders at your branch.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Email</th>
                      <th>Active Pair</th>
                      <th>Service</th>
                      <th>Order Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.customer}</b>
                        </td>
                        <td>{o.email}</td>
                        <td>{o.shoe}</td>
                        <td>{o.service}</td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* STAFF TAB: NOTIFICATIONS */}
          {tab === 'Notifications' && (
            <>
              <span className="eyebrow">STAFF ALERTS</span>
              <h1>Notifications</h1>
              <p>Branch drop-off alerts, documentation checks, and low-stock notifications.</p>

              <div className="dash-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                  <b>Outsole After-Photo Needed — WMK-2026-0046</b>
                  <p style={{ fontSize: 12.5, color: '#6b7280', margin: '4px 0 0' }}>
                    Upload final Sole after-photo in Before &amp; After Documentation to complete Quality Check.
                  </p>
                </div>
                <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                  <b>New Drop-Off Assigned — WMK-2026-01849</b>
                  <p style={{ fontSize: 12.5, color: '#6b7280', margin: '4px 0 0' }}>
                    Angela Mercado dropped off New Balance 2002R for Restoration. Please complete initial Shoe Assessment.
                  </p>
                </div>
                <div style={{ padding: 14, border: '1px solid #e5e7eb', borderRadius: 10 }}>
                  <b>Branch Inventory Low Alert — San Juan City</b>
                  <p style={{ fontSize: 12.5, color: '#6b7280', margin: '4px 0 0' }}>
                    Water Repellent 250ml is down to 7 / 25 units. Check the Inventory module to restock or transfer.
                  </p>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  )
}

/* ============================================================================
   ADMIN DASHBOARD FLOW
   ============================================================================ */

function AdminDashboard({
  userMeta,
  orders,
  setOrders,
  inventory,
  setInventory,
  onLogout,
}: {
  userMeta: { name: string; email: string }
  orders: JobOrder[]
  setOrders: React.Dispatch<React.SetStateAction<JobOrder[]>>
  inventory: InventoryRecord[]
  setInventory: React.Dispatch<React.SetStateAction<InventoryRecord[]>>
  onLogout: () => void
}) {
  const [tab, setTab] = useState<
    | 'Dashboard'
    | 'Branches'
    | 'Inventory'
    | 'CRM'
    | 'Job Orders'
    | 'Reports'
    | 'Audit Trail'
    | 'User Management'
    | 'Settings'
  >('Dashboard')
  const [toast, setToast] = useState('')

  const [usersList, setUsersList] = useState([
    { id: 'USR-01', name: 'Juan Dela Cruz', email: 'juan.delacruz@email.com', role: 'Customer', branch: 'San Juan City', active: true },
    { id: 'USR-02', name: 'Carlo Mendoza', email: 'carlo.mendoza@washmykicks.com', role: 'Staff', branch: 'San Juan City', active: true },
    { id: 'USR-03', name: 'Marco Santos', email: 'marco.santos@washmykicks.com', role: 'Staff', branch: 'Quezon City', active: true },
    { id: 'USR-04', name: 'Mika Cruz', email: 'admin@washmykicks.com', role: 'Administrator', branch: 'HQ / All Branches', active: true },
  ])

  const sidebarItems: { key: typeof tab; icon: React.ReactNode }[] = [
    { key: 'Dashboard', icon: <LayoutDashboard size={17} /> },
    { key: 'Branches', icon: <Building2 size={17} /> },
    { key: 'Inventory', icon: <Package size={17} /> },
    { key: 'CRM', icon: <Users size={17} /> },
    { key: 'Job Orders', icon: <ClipboardCheck size={17} /> },
    { key: 'Reports', icon: <BarChart3 size={17} /> },
    { key: 'Audit Trail', icon: <FileText size={17} /> },
    { key: 'User Management', icon: <ShieldCheck size={17} /> },
    { key: 'Settings', icon: <SettingsIcon size={17} /> },
  ]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const lowStockCount = inventory.filter(
    (i) => getInventoryStatus(i.stock, i.target) !== 'Healthy'
  ).length

  return (
    <section className="dashboard">
      <aside className="sidebar dark-sidebar">
        <Brand />
        <span className="portal-label">ADMINISTRATOR PORTAL</span>
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-btn ${tab === item.key ? 'selected' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            <span>{item.key}</span>
          </button>
        ))}
        <button type="button" className="sidebar-btn logout" onClick={onLogout}>
          <LogOut size={17} />
          <span>Log out</span>
        </button>
      </aside>

      <div className="dash-main">
        <header className="dash-header">
          <div className="dash-search">
            <Search size={15} />
            <input placeholder="Search orders and customers..." />
          </div>
          <div className="dash-user">
            <button type="button" className="dash-bell-btn" onClick={() => setTab('Audit Trail')}>
              <Bell size={17} />
              <span className="badge-dot">3</span>
            </button>
            <div className="dash-avatar">MC</div>
            <div className="dash-user-info">
              <b>{userMeta.name}</b>
              <small>Administrator</small>
            </div>
          </div>
        </header>

        <main className="dash-content">
          {toast && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '12px 18px',
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ✓ {toast}
            </div>
          )}

          {/* ADMIN DASHBOARD OVERVIEW: 7 WIDGETS + ACTION BANNER + QUEUE/UPDATES + 4 CHARTS */}
          {tab === 'Dashboard' && (
            <>
              <div className="wmk-breadcrumb">
                <b>Dashboard</b> &gt; Good morning, {userMeta.name.split(' ')[0]}.
              </div>
              <span className="eyebrow">EXECUTIVE COMMAND CENTER</span>
              <h1>Good morning, {userMeta.name.split(' ')[0]}.</h1>
              <p>All 7 branches · Tuesday, March 24</p>

              {/* Row 1: 7 Required Admin Widgets styled with the white card + icon UI */}
              <div className="wmk-inv-kpi-grid">
                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Package size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Total Orders Today</span>
                    <b>46 orders</b>
                    <small>+14% vs yesterday</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon red">
                    <Clock3 size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Orders In Progress</span>
                    <b>128 pairs</b>
                    <small>Across 7 active branches</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon green">
                    <Check size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Completed Orders</span>
                    <b>64 pairs</b>
                    <small>Completed today</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Job Orders')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Sparkles size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Ready for Pickup</span>
                    <b>23 pairs</b>
                    <small>Awaiting customer claim</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('CRM')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon dark">
                    <Users size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Active Customers</span>
                    <b>8,492</b>
                    <small>96% retention rate</small>
                  </div>
                </div>

                <div className="wmk-inv-kpi-card" onClick={() => setTab('Inventory')} style={{ cursor: 'pointer' }}>
                  <div className="wmk-inv-kpi-icon red">
                    <Bell size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Inventory Alerts</span>
                    <b>{17 + lowStockCount} alerts</b>
                    <small>Needs attention</small>
                  </div>
                </div>

                <div
                  className="wmk-inv-kpi-card"
                  onClick={() => setTab('Reports')}
                  style={{ cursor: 'pointer', gridColumn: 'span 2' }}
                >
                  <div className="wmk-inv-kpi-icon green">
                    <BarChart3 size={18} />
                  </div>
                  <div className="wmk-inv-kpi-body">
                    <span>Revenue Summary</span>
                    <b>₱784,820</b>
                    <small>Month-to-date gross revenue across all branches</small>
                  </div>
                </div>
              </div>

              {/* Row 2: Horizontal Admin Actions Banner */}
              <div className="wmk-action-banner">
                <div>
                  <span className="eyebrow">ADMINISTRATOR ACTIONS</span>
                  <h3>Continue your network operations workflow.</h3>
                </div>
                <div className="wmk-action-banner-btns">
                  <button type="button" className="primary" onClick={() => setTab('Inventory')}>
                    <Package size={15} /> Manage Inventory
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Reports')}>
                    <BarChart3 size={15} /> Revenue Reports
                  </button>
                  <button type="button" className="outline" onClick={() => setTab('Branches')}>
                    <Building2 size={15} /> Branch Network
                  </button>
                </div>
              </div>

              {/* Row 3: 2-Column Split (Priority Queue + Network Updates) */}
              <div className="wmk-dash-split" style={{ marginBottom: 18 }}>
                <div className="wmk-queue-card">
                  <div className="wmk-queue-head">
                    <div>
                      <span className="eyebrow">ALL-BRANCH JOB ORDERS</span>
                      <h3>Today&apos;s priority queue</h3>
                    </div>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Job Orders')}>
                      View all
                    </button>
                  </div>

                  <table className="wmk-queue-table">
                    <thead>
                      <tr>
                        <th>Job order</th>
                        <th>Customer</th>
                        <th>Shoe</th>
                        <th>Service</th>
                        <th>Branch</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          id: 'WMK-2026-0046',
                          customer: 'Andrea Reyes',
                          shoe: 'Nike Air Max 97',
                          service: 'Restoration',
                          branch: 'San Juan City',
                          priority: 'High',
                          priorityClass: 'high',
                          status: 'In Service',
                        },
                        {
                          id: 'WMK-2026-0045',
                          customer: 'Paolo Tan',
                          shoe: 'Jordan 4',
                          service: 'Deep Cleaning',
                          branch: 'Quezon City',
                          priority: 'Normal',
                          priorityClass: 'normal',
                          status: 'Assessment',
                        },
                        {
                          id: 'WMK-2026-0044',
                          customer: 'Sam Lee',
                          shoe: 'Adidas Samba',
                          service: 'Sole Repair',
                          branch: 'Pasig City',
                          priority: 'Urgent',
                          priorityClass: 'urgent',
                          status: 'Quality Check',
                        },
                        {
                          id: 'WMK-2026-0043',
                          customer: 'Nicole Cruz',
                          shoe: 'New Balance 550',
                          service: 'Basic Clean',
                          branch: 'Pateros',
                          priority: 'Normal',
                          priorityClass: 'normal',
                          status: 'Ready',
                        },
                        {
                          id: 'WMK-2026-0042',
                          customer: 'John Uy',
                          shoe: 'Nike Dunk Low',
                          service: 'Restoration',
                          branch: 'Montalban, Rizal',
                          priority: 'High',
                          priorityClass: 'high',
                          status: 'Received',
                        },
                      ].map((row) => {
                        const liveOrder = orders.find((o) => o.id === row.id)
                        const liveStatus = liveOrder ? liveOrder.status : row.status
                        return (
                          <tr key={row.id}>
                            <td>
                              <b>{row.id}</b>
                            </td>
                            <td>{row.customer}</td>
                            <td>{row.shoe}</td>
                            <td>{row.service}</td>
                            <td>{row.branch}</td>
                            <td>
                              <span className={`wmk-priority-tag ${row.priorityClass}`}>{row.priority}</span>
                            </td>
                            <td>
                              <StatusBadge status={liveStatus} />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="wmk-dots-btn"
                                onClick={() => setTab('Job Orders')}
                                title="Manage order"
                              >
                                •••
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="wmk-updates-card">
                  <div className="wmk-updates-head">
                    <h3>Branch updates</h3>
                    <button type="button" className="wmk-link-btn" onClick={() => setTab('Audit Trail')}>
                      View all
                    </button>
                  </div>

                  <div className="wmk-update-list">
                    <div className="wmk-update-item" onClick={() => setTab('Inventory')}>
                      <div className="wmk-update-icon">
                        <Bell size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>Low stock alert</b>
                        <span>San Juan City · 8 min ago</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>

                    <div className="wmk-update-item" onClick={() => setTab('Job Orders')}>
                      <div className="wmk-update-icon">
                        <Camera size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>After photos due</b>
                        <span>WMK-2026-0046 · Today</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>

                    <div className="wmk-update-item" onClick={() => setTab('Reports')}>
                      <div className="wmk-update-icon">
                        <Check size={15} />
                      </div>
                      <div className="wmk-update-body">
                        <b>Daily revenue milestone</b>
                        <span>₱784,820 MTD · Today</span>
                      </div>
                      <ChevronRight size={15} className="wmk-update-arrow" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: 4 Required Admin Charts */}
              <div className="charts-grid">
                {/* Chart 1: Orders Per Branch */}
                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">CHART 1 · BRANCH VOLUME</span>
                  <h2>Orders Per Branch</h2>
                  {[
                    ['San Juan City', 168, 92],
                    ['Quezon City', 152, 84],
                    ['Pasig City', 134, 74],
                    ['Pateros', 98, 54],
                    ['Montalban Rizal', 86, 48],
                    ['Morong Rizal', 74, 41],
                    ['Bacoor Cavite', 92, 51],
                  ].map(([name, count, pct]) => (
                    <div key={String(name)} className="chart-bar-row">
                      <div className="chart-bar-label">
                        <span>{name}</span>
                        <b>{count} orders</b>
                      </div>
                      <div className="chart-bar-track">
                        <div className="chart-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart 2: Revenue Trends */}
                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">CHART 2 · FINANCIAL PERFORMANCE</span>
                  <h2>Revenue Trends</h2>
                  {[
                    ['Week 1 (Mar 1–7)', '₱178,400', 68],
                    ['Week 2 (Mar 8–14)', '₱194,250', 76],
                    ['Week 3 (Mar 15–21)', '₱201,900', 82],
                    ['Week 4 (Mar 22–28)', '₱210,270', 91],
                  ].map(([week, rev, pct]) => (
                    <div key={String(week)} className="chart-bar-row">
                      <div className="chart-bar-label">
                        <span>{week}</span>
                        <b>{rev}</b>
                      </div>
                      <div className="chart-bar-track">
                        <div className="chart-bar-fill" style={{ width: `${pct}%`, background: '#111827' }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 18, padding: 12, background: '#f9fafb', borderRadius: 10, fontSize: 12 }}>
                    <b>Peak Revenue Day:</b> Saturdays (avg. ₱42,800/day across all branches)
                  </div>
                </div>

                {/* Chart 3: Inventory Usage */}
                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">CHART 3 · CONSUMABLES TRACKING</span>
                  <h2>Inventory Usage</h2>
                  {inventory.slice(0, 5).map((item) => {
                    const usedPct = Math.min(96, Math.max(20, 100 - Math.round((item.stock / Math.max(item.target, 1)) * 100)))
                    return (
                      <div key={item.id} className="chart-bar-row">
                        <div className="chart-bar-label">
                          <span>{item.name}</span>
                          <b>{usedPct}% utilized</b>
                        </div>
                        <div className="chart-bar-track">
                          <div
                            className="chart-bar-fill"
                            style={{
                              width: `${usedPct}%`,
                              background: usedPct > 70 ? '#dc2626' : '#2563eb',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Chart 4: Service Popularity */}
                <div className="dash-panel" style={{ marginTop: 0 }}>
                  <span className="eyebrow">CHART 4 · SERVICE MIX</span>
                  <h2>Service Popularity</h2>
                  {[
                    ['Deep Cleaning (₱650)', '44% of bookings', 88],
                    ['Basic Cleaning (₱350)', '26% of bookings', 56],
                    ['Restoration (From ₱1,200)', '14% of bookings', 38],
                    ['Shoe Protection (₱280)', '10% of bookings', 28],
                    ['Shoe Repair (From ₱800)', '6% of bookings', 18],
                  ].map(([svc, share, pct]) => (
                    <div key={String(svc)} className="chart-bar-row">
                      <div className="chart-bar-label">
                        <span>{svc}</span>
                        <b>{share}</b>
                      </div>
                      <div className="chart-bar-track">
                        <div className="chart-bar-fill" style={{ width: `${pct}%`, background: '#059669' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ADMIN TAB: BRANCHES */}
          {tab === 'Branches' && (
            <>
              <span className="eyebrow">NETWORK MANAGEMENT</span>
              <h1>Branches</h1>
              <p>Monitor branch capacity, assigned specialists, and daily order volume.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Branch Name</th>
                      <th>Address</th>
                      <th>Lead Specialist</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wizardBranches.map((b) => (
                      <tr key={b.id}>
                        <td>0{b.id}</td>
                        <td>
                          <b>{b.name}</b>
                        </td>
                        <td>{b.address}</td>
                        <td>{b.comingSoon ? 'TBA' : 'Assigned Branch Team'}</td>
                        <td>
                          <span className={`status-pill ${b.comingSoon ? 'amber' : 'green'}`}>
                            {b.comingSoon ? 'Coming Soon' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: INVENTORY */}
          {tab === 'Inventory' && (
            <InventoryManagementModule
              roleLabel="ADMINISTRATION"
              branches={staffBranches}
              inventory={inventory}
              setInventory={setInventory}
              onBackToDashboard={() => setTab('Dashboard')}
              onNotify={showToast}
            />
          )}

          {/* ADMIN TAB: CRM */}
          {tab === 'CRM' && (
            <>
              <span className="eyebrow">CUSTOMER RELATIONSHIP MANAGEMENT</span>
              <h1>CRM</h1>
              <p>Customer profiles, lifetime sneaker care value, and retention insights.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Preferred Branch</th>
                      <th>Completed Pairs</th>
                      <th>Loyalty Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Juan Dela Cruz', 'juan.delacruz@email.com', 'San Juan City', 12, 'VIP Sneakerhead'],
                      ['Angela Mercado', 'angela.m@email.com', 'San Juan City', 7, 'Gold Member'],
                      ['Jiro Reyes', 'jiro.reyes@email.com', 'Quezon City', 5, 'Silver Member'],
                      ['Kaye Santos', 'kaye.s@email.com', 'Pasig City', 9, 'Gold Member'],
                    ].map(([name, email, branch, pairs, tier]) => (
                      <tr key={String(email)}>
                        <td>
                          <b>{name}</b>
                        </td>
                        <td>{email}</td>
                        <td>{branch}</td>
                        <td>{pairs} pairs</td>
                        <td>
                          <span className="status-pill blue">{tier}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: JOB ORDERS */}
          {tab === 'Job Orders' && (
            <>
              <span className="eyebrow">ALL-BRANCH JOB ORDERS</span>
              <h1>Job Orders</h1>
              <p>Complete visibility and specialist assignment across all branches.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Order</th>
                      <th>Customer</th>
                      <th>Sneaker</th>
                      <th>Service</th>
                      <th>Branch</th>
                      <th>Specialist</th>
                      <th>Status</th>
                      <th>Update Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.id}</b>
                        </td>
                        <td>{o.customer}</td>
                        <td>{o.shoe}</td>
                        <td>{o.service}</td>
                        <td>{o.branch}</td>
                        <td>
                          <select
                            value={o.specialist}
                            onChange={(e) => {
                              const nextSpec = e.target.value
                              setOrders((prev) =>
                                prev.map((ord) => (ord.id === o.id ? { ...ord, specialist: nextSpec } : ord))
                              )
                              showToast(`Assigned ${nextSpec} to ${o.id}.`)
                            }}
                            style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}
                          >
                            <option value="Carlo Mendoza">Carlo Mendoza</option>
                            <option value="Marco Santos">Marco Santos</option>
                            <option value="Paolo Rivera">Paolo Rivera</option>
                          </select>
                        </td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>
                          <StatusSelect
                            value={o.status}
                            onChange={(next) => {
                              setOrders((prev) =>
                                prev.map((ord) => (ord.id === o.id ? { ...ord, status: next } : ord))
                              )
                              showToast(`Updated ${o.id} status to "${next}".`)
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: REPORTS */}
          {tab === 'Reports' && (
            <>
              <span className="eyebrow">ANALYTICS & EXPORTS</span>
              <h1>Reports</h1>
              <p>Financial summaries, turnaround efficiency, and branch KPI exports.</p>

              <div className="dash-panel">
                <div className="dash-stats" style={{ marginBottom: 20 }}>
                  <article>
                    <span>Gross Monthly Revenue</span>
                    <b>₱784,820</b>
                    <small>+18.4% MoM</small>
                  </article>
                  <article>
                    <span>Avg. Ticket Value</span>
                    <b>₱685</b>
                    <small>Driven by Deep Cleaning & Restoration</small>
                  </article>
                  <article>
                    <span>On-Time Turnaround</span>
                    <b>98.2%</b>
                    <small>Across all 7 branches</small>
                  </article>
                  <article>
                    <span>Customer CSAT</span>
                    <b>4.92 / 5.0</b>
                    <small>Based on verified reviews</small>
                  </article>
                </div>
                <button
                  type="button"
                  className="primary"
                  onClick={() => showToast('Exported WashMyKicks_March2026_Executive_Report.csv')}
                >
                  Export Full Financial & Operations Report (CSV)
                </button>
              </div>
            </>
          )}

          {/* ADMIN TAB: AUDIT TRAIL */}
          {tab === 'Audit Trail' && (
            <>
              <span className="eyebrow">SECURITY & COMPLIANCE LOGS</span>
              <h1>Audit Trail</h1>
              <p>Immutable chronological record of role logins, status changes, and inventory updates.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Actor</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['2026-03-28 10:42 AM', 'Mika Cruz', 'Administrator', 'Viewed Revenue & Branch Reports', 'All Branches'],
                      ['2026-03-28 10:15 AM', 'Carlo Mendoza (WMK-EMP-0104)', 'Staff', 'Uploaded Before & After Photos', 'WMK-2026-01842'],
                      ['2026-03-28 09:50 AM', 'Juan Dela Cruz', 'Customer', 'Booked Deep Cleaning Appointment', 'San Juan City Branch'],
                      ['2026-03-28 09:12 AM', 'Marco Santos (WMK-EMP-0109)', 'Staff', 'Updated Order Status to Ready for Pickup', 'WMK-2026-01835'],
                    ].map(([time, actor, r, action, target], i) => (
                      <tr key={i}>
                        <td>{time}</td>
                        <td>
                          <b>{actor}</b>
                        </td>
                        <td>
                          <span className="status-pill gray">{r}</span>
                        </td>
                        <td>{action}</td>
                        <td>{target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: USER MANAGEMENT */}
          {tab === 'User Management' && (
            <>
              <span className="eyebrow">ROLE & ACCOUNT ADMINISTRATION</span>
              <h1>User Management</h1>
              <p>Manage Customer, Staff, and Administrator accounts and role permissions.</p>

              <div className="dash-panel">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Assigned Role</th>
                      <th>Branch</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>
                          <b>{u.name}</b>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <span className="status-pill blue">{u.role}</span>
                        </td>
                        <td>{u.branch}</td>
                        <td>
                          <span className={`status-pill ${u.active ? 'green' : 'gray'}`}>
                            {u.active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="outline"
                            style={{ padding: '5px 10px', fontSize: 11 }}
                            onClick={() => {
                              setUsersList((prev) =>
                                prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x))
                              )
                              showToast(`Updated account status for ${u.name}.`)
                            }}
                          >
                            {u.active ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ADMIN TAB: SETTINGS & RBAC MATRIX */}
          {tab === 'Settings' && (
            <>
              <span className="eyebrow">SYSTEM CONFIGURATION</span>
              <h1>Settings</h1>
              <p>Configure Role-Based Access Control (RBAC) policies and global system preferences.</p>

              <div className="dash-panel">
                <h2>Role-Based Access Control (RBAC) Policy Matrix</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Module / Capability</th>
                      <th>Customer Role</th>
                      <th>Staff Role</th>
                      <th>Administrator Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Homepage & Public Pages', '✔ Allowed', '✔ Allowed', '✔ Allowed'],
                      ['Book Appointment & Track Order', '✔ Allowed', '✖ Restricted', '✔ Allowed'],
                      ['Reviews & Customer Profile', '✔ Allowed', '✖ Restricted', '✔ Allowed'],
                      ['Job Orders & Status Updates', '✖ Restricted', '✔ Allowed', '✔ Allowed'],
                      ['Shoe Assessments & Documentation', '✖ Restricted', '✔ Allowed', '✔ Allowed'],
                      ['Inventory Management', '✖ Restricted', '✔ Allowed', '✔ Allowed'],
                      ['Revenue Reports & CRM', '✖ Restricted', '✖ Restricted', '✔ Allowed'],
                      ['Audit Trail & User Management', '✖ Restricted', '✖ Restricted', '✔ Allowed'],
                      ['System Settings', '✖ Restricted', '✖ Restricted', '✔ Allowed'],
                    ].map(([mod, cust, stf, adm]) => (
                      <tr key={String(mod)}>
                        <td>
                          <b>{mod}</b>
                        </td>
                        <td style={{ color: String(cust).startsWith('✔') ? '#059669' : '#dc2626', fontWeight: 600 }}>
                          {cust}
                        </td>
                        <td style={{ color: String(stf).startsWith('✔') ? '#059669' : '#dc2626', fontWeight: 600 }}>
                          {stf}
                        </td>
                        <td style={{ color: '#059669', fontWeight: 700 }}>{adm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="dash-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => showToast('System & RBAC policies saved to system_settings.')}
                  >
                    Save System Configuration
                  </button>
                  <button
                    type="button"
                    className="outline"
                    onClick={() => {
                      void triggerDatabaseBackupManifest().catch(() => null)
                      showToast('Daily database backup manifest & integrity snapshot recorded in audit_logs.')
                    }}
                  >
                    Run Daily Backup Snapshot
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  )
}

/* ============================================================================
   PUBLIC SHOE BOOKING MANAGEMENT MODULE (PRE-SELECTED BRANCH INTEGRATION)
   ============================================================================ */

function PublicShoeBookingModule({
  initialBranchId,
  preselectedFromMap,
  onCompleteBooking,
  setPage,
}: {
  initialBranchId: number
  preselectedFromMap: boolean
  onCompleteBooking: (newOrder: JobOrder) => void
  setPage: (p: string) => void
}) {
  const [bookedOrder, setBookedOrder] = useState<JobOrder | null>(null)

  if (bookedOrder) {
    return (
      <section className="listing">
        <div className="wizard-card" style={{ textAlign: 'center', maxWidth: 620 }}>
          <span className="eyebrow">APPOINTMENT CONFIRMED</span>
          <h2 style={{ fontSize: 28, margin: '10px 0 8px' }}>Your kicks are scheduled!</h2>
          <p style={{ fontSize: 13.5, color: '#4b5563', marginBottom: 20 }}>
            Job Order <b>{bookedOrder.id}</b> has been created at <b>{bookedOrder.branch}</b> on{' '}
            <b>
              {bookedOrder.date} · {bookedOrder.time}
            </b>
            .
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="primary" onClick={() => setPage('track')}>
              Track My Order ({bookedOrder.id}) <ArrowRight size={15} />
            </button>
            <button type="button" className="outline" onClick={() => setPage('login-customer')}>
              Open in Customer Portal
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="listing" style={{ paddingTop: 48 }}>
      <CustomerBookAppointmentWizard
        initialBranchId={initialBranchId}
        preselectedFromMap={preselectedFromMap}
        onCancel={() => setPage('home')}
        onCompleteBooking={(order) => {
          onCompleteBooking(order)
          setBookedOrder(order)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    </section>
  )
}

/* ============================================================================
   MAIN APPLICATION ROUTER & STATE
   ============================================================================ */

function App() {
  const [page, setPage] = useState('home')
  const [activeRole, setActiveRole] = useState<Role | null>(null)
  const [preselectedBranchId, setPreselectedBranchId] = useState<number>(1)
  const [preselectedFromMap, setPreselectedFromMap] = useState<boolean>(false)
  const [customerInitialTab, setCustomerInitialTab] = useState<
    'Dashboard' | 'Book Appointment' | 'Track Shoes' | 'Notifications' | 'Service History' | 'Reviews' | 'Profile'
  >('Dashboard')

  const [userMeta, setUserMeta] = useState<{
    name: string
    email: string
    employeeId?: string
    branch?: string
  }>({
    name: 'Juan Dela Cruz',
    email: 'juan.delacruz@email.com',
    employeeId: 'WMK-EMP-0104',
    branch: staffBranches[0],
  })

  const [orders, setOrders] = useState<JobOrder[]>(initialOrders)
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews)
  const [inventory, setInventory] = useState<InventoryRecord[]>(INITIAL_INVENTORY_RECORDS)

  const handleBookBranchFromMap = (_branchName: string, branchId: number) => {
    setPreselectedBranchId(branchId)
    setPreselectedFromMap(true)
    if (activeRole === 'customer') {
      setCustomerInitialTab('Book Appointment')
      setPage('dashboard-customer')
    } else {
      setCustomerInitialTab('Book Appointment')
      setPage('book')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLoginSuccess = (
    role: Role,
    meta: { email: string; employeeId?: string; branch?: string; name?: string }
  ) => {
    setActiveRole(role)
    setUserMeta({
      name: meta.name || (role === 'customer' ? 'Juan Dela Cruz' : role === 'staff' ? 'Carlo Mendoza' : 'Mika Cruz'),
      email: meta.email,
      employeeId: meta.employeeId,
      branch: meta.branch,
    })
    if (role === 'customer' && preselectedFromMap) {
      setCustomerInitialTab('Book Appointment')
    } else {
      setCustomerInitialTab('Dashboard')
    }
    setPage(`dashboard-${role}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = () => {
    void signOutSession(userMeta.email).catch(() => null)
    setActiveRole(null)
    setCustomerInitialTab('Dashboard')
    setPage('login')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Role-Specific Login Pages
  if (page.startsWith('login-')) {
    const role = page.replace('login-', '') as Role
    return <RoleLogin role={role} setPage={setPage} onLoginSuccess={handleLoginSuccess} />
  }

  // Role Dashboards
  if (page === 'dashboard-customer') {
    return (
      <CustomerDashboard
        userMeta={userMeta}
        orders={orders}
        setOrders={setOrders}
        reviews={reviews}
        setReviews={setReviews}
        setPage={setPage}
        onLogout={handleLogout}
        initialTab={customerInitialTab}
        preselectedBranchId={preselectedBranchId}
        preselectedFromMap={preselectedFromMap}
      />
    )
  }

  if (page === 'dashboard-staff') {
    return (
      <StaffDashboard
        userMeta={userMeta}
        orders={orders}
        setOrders={setOrders}
        inventory={inventory}
        setInventory={setInventory}
        onLogout={handleLogout}
      />
    )
  }

  if (page === 'dashboard-admin') {
    return (
      <AdminDashboard
        userMeta={userMeta}
        orders={orders}
        setOrders={setOrders}
        inventory={inventory}
        setInventory={setInventory}
        onLogout={handleLogout}
      />
    )
  }

  // Public Pages & Account Selection Screen
  const content =
    page === 'home' ? (
      <Home setPage={setPage} onBookBranch={handleBookBranchFromMap} />
    ) : page === 'services' ? (
      <Services setPage={setPage} />
    ) : page === 'track' ? (
      <Track orders={orders} setPage={setPage} />
    ) : page === 'branches' ? (
      <Branches onBookBranch={handleBookBranchFromMap} />
    ) : page === 'book' ? (
      <PublicShoeBookingModule
        initialBranchId={preselectedBranchId}
        preselectedFromMap={preselectedFromMap}
        onCompleteBooking={(newOrder) => setOrders((prev) => [newOrder, ...prev])}
        setPage={setPage}
      />
    ) : page === 'reviews' ? (
      <Reviews reviews={reviews} />
    ) : page === 'about' ? (
      <About />
    ) : (
      <AccountSelectionPage setPage={setPage} />
    )

  return (
    <>
      <Header page={page} setPage={setPage} activeRole={activeRole} />
      <main>{content}</main>
      <Footer setPage={setPage} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
