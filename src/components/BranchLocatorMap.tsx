import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  Compass,
  Crosshair,
  ExternalLink,
  Info,
  Layers,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Minus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

export type BranchLocation = {
  id: number
  name: string
  shortName: string
  address: string
  city: string
  lat: number
  lng: number
  phone: string
  openHour: number // 24h format in Asia/Manila, e.g. 10 = 10:00 AM
  closeHour: number // 24h format in Asia/Manila, e.g. 20 = 8:00 PM
  hoursLabel: string
  services: string[]
  landmark: string
  turnaroundNote: string
}

export const BRANCH_LOCATIONS: BranchLocation[] = [
  {
    id: 1,
    name: 'Wash My Kicks – San Juan City',
    shortName: 'San Juan City',
    address: '300 Col. Bonny Serrano Ave., San Juan City',
    city: 'San Juan City, Metro Manila',
    lat: 14.6084,
    lng: 121.0435,
    phone: '+63 917 801 1001',
    openHour: 10,
    closeHour: 20,
    hoursLabel: 'Mon – Sun · 10:00 AM – 8:00 PM',
    services: ['Basic Cleaning', 'Deep Cleaning', 'Restoration', 'Shoe Repair', 'Shoe Protection'],
    landmark: 'Along Col. Bonny Serrano Ave. near Katipunan / Santolan corridor',
    turnaroundNote: 'Express 24-hour Shoe Protection & full Restoration lab available on-site.',
  },
  {
    id: 2,
    name: 'Wash My Kicks – Quezon City',
    shortName: 'Quezon City',
    address: 'Tomas Morato Ave. cor. Scout Lozano, Quezon City',
    city: 'Quezon City, Metro Manila',
    lat: 14.6328,
    lng: 121.0349,
    phone: '+63 917 801 1002',
    openHour: 10,
    closeHour: 20,
    hoursLabel: 'Mon – Sun · 10:00 AM – 8:00 PM',
    services: ['Basic Cleaning', 'Deep Cleaning', 'Restoration', 'Shoe Repair', 'Shoe Protection'],
    landmark: 'Tomas Morato commercial strip, accessible from Timog & Quezon Ave.',
    turnaroundNote: 'High-capacity deep cleaning & UV midsole de-yellowing chamber.',
  },
  {
    id: 3,
    name: 'Wash My Kicks – Pasig City',
    shortName: 'Pasig City',
    address: 'West Capitol Dr., Brgy. Kapitolyo, Pasig City',
    city: 'Pasig City, Metro Manila',
    lat: 14.5714,
    lng: 121.0615,
    phone: '+63 917 801 1003',
    openHour: 10,
    closeHour: 20,
    hoursLabel: 'Mon – Sun · 10:00 AM – 8:00 PM',
    services: ['Basic Cleaning', 'Deep Cleaning', 'Restoration', 'Shoe Repair', 'Shoe Protection'],
    landmark: 'Minutes from Ortigas Center, Capitol Commons, and Shaw Blvd.',
    turnaroundNote: 'Full sneaker care, suede revival, and custom repainting specialists.',
  },
  {
    id: 4,
    name: 'Wash My Kicks – Pateros',
    shortName: 'Pateros',
    address: '402 G. De Borja St., Brgy. Aguho, Pateros',
    city: 'Pateros, Metro Manila',
    lat: 14.5446,
    lng: 121.0667,
    phone: '+63 917 801 1004',
    openHour: 10,
    closeHour: 20,
    hoursLabel: 'Mon – Sun · 10:00 AM – 8:00 PM',
    services: ['Basic Cleaning', 'Deep Cleaning', 'Restoration', 'Shoe Repair', 'Shoe Protection'],
    landmark: '402 G. De Borja St., Brgy. Aguho — convenient to BGC, Taguig & Makati.',
    turnaroundNote: 'Dedicated drop-off counter with photo-documented 5-point quality check.',
  },
  {
    id: 5,
    name: 'Wash My Kicks – Montalban, Rizal',
    shortName: 'Montalban, Rizal',
    address: 'E. Rodriguez Hwy, Brgy. San Jose, Montalban, Rizal',
    city: 'Rodriguez (Montalban), Rizal',
    lat: 14.7305,
    lng: 121.1424,
    phone: '+63 917 801 1005',
    openHour: 10,
    closeHour: 20,
    hoursLabel: 'Mon – Sun · 10:00 AM – 8:00 PM',
    services: ['Basic Cleaning', 'Deep Cleaning', 'Restoration', 'Shoe Protection'],
    landmark: 'Main E. Rodriguez Highway commercial center, Montalban.',
    turnaroundNote: 'Serving northern Rizal, San Mateo, and nearby Quezon City communities.',
  },
  {
    id: 6,
    name: 'Wash My Kicks – Morong, Rizal',
    shortName: 'Morong, Rizal',
    address: '2nd Floor A5R Commercial Space Rental, Manila East Road, Morong, Rizal',
    city: 'Morong, Rizal',
    lat: 14.5142,
    lng: 121.2386,
    phone: '+63 917 801 1006',
    openHour: 10,
    closeHour: 20,
    hoursLabel: 'Mon – Sun · 10:00 AM – 8:00 PM',
    services: ['Basic Cleaning', 'Deep Cleaning', 'Restoration', 'Shoe Repair', 'Shoe Protection'],
    landmark: '2nd Floor A5R Commercial Space Rental along Manila East Road.',
    turnaroundNote: 'Easy highway parking and drop-off for East Rizal sneakerheads.',
  },
  {
    id: 7,
    name: 'Wash My Kicks – Bacoor, Cavite',
    shortName: 'Bacoor, Cavite',
    address: 'Cerritos Trails Molino 3, Bacoor, Cavite',
    city: 'Bacoor, Cavite',
    lat: 14.3986,
    lng: 120.9778,
    phone: '+63 917 801 1007',
    openHour: 10,
    closeHour: 20,
    hoursLabel: 'Mon – Sun · 10:00 AM – 8:00 PM',
    services: ['Basic Cleaning', 'Deep Cleaning', 'Restoration', 'Shoe Repair', 'Shoe Protection'],
    landmark: 'Cerritos Trails, Molino 3 — accessible via Molino Blvd & Daang Hari.',
    turnaroundNote: 'South hub serving Bacoor, Imus, Las Piñas, and Alabang.',
  },
]

type MapMode = 'satellite' | 'hybrid' | 'standard'

declare global {
  interface Window {
    L?: any
  }
}

let leafletPromise: Promise<any> | null = null

function loadLeaflet(): Promise<any> {
  if (typeof window !== 'undefined' && window.L) {
    return Promise.resolve(window.L)
  }
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('wmk-leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'wmk-leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = () => {
      const backup = document.createElement('script')
      backup.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      backup.async = true
      backup.onload = () => resolve(window.L)
      backup.onerror = reject
      document.body.appendChild(backup)
    }
    document.body.appendChild(script)
  })

  return leafletPromise
}

/** Haversine distance in kilometers */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

/** Real-time Open / Closed check using Philippine Time (UTC+8) */
function getBranchOpenStatus(openHour: number, closeHour: number): { isOpen: boolean; statusText: string } {
  try {
    const nowManila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const hour = nowManila.getHours()
    const isOpen = hour >= openHour && hour < closeHour
    return {
      isOpen,
      statusText: isOpen ? 'Open · Closes 8:00 PM' : 'Closed · Opens 10:00 AM',
    }
  } catch {
    const hour = new Date().getHours()
    const isOpen = hour >= openHour && hour < closeHour
    return {
      isOpen,
      statusText: isOpen ? 'Open · Closes 8:00 PM' : 'Closed · Opens 10:00 AM',
    }
  }
}

export function BranchLocatorMap({
  onBookBranch,
}: {
  onBookBranch: (branchName: string, branchId: number) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayersRef = useRef<any[]>([])
  const markersLayerRef = useRef<any>(null)
  const userLayerRef = useRef<any>(null)

  // Default View: Satellite Mode (per specification)
  const [mapMode, setMapMode] = useState<MapMode>('satellite')
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1)
  const [showPinCard, setShowPinCard] = useState<boolean>(true)
  const [detailsModalBranch, setDetailsModalBranch] = useState<BranchLocation | null>(null)

  // Search & Geolocation state
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isSearchingGeo, setIsSearchingGeo] = useState<boolean>(false)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; label: string } | null>(null)
  const [geoStatusMsg, setGeoStatusMsg] = useState<string>('')
  const [isLocating, setIsLocating] = useState<boolean>(false)
  const [mapReady, setMapReady] = useState<boolean>(false)
  const [currentZoom, setCurrentZoom] = useState<number>(11)

  // Compute distances & nearest branch when userCoords is available
  const branchesWithMeta = useMemo(() => {
    const list = BRANCH_LOCATIONS.map((b) => {
      const dist = userCoords ? calculateDistanceKm(userCoords.lat, userCoords.lng, b.lat, b.lng) : null
      const status = getBranchOpenStatus(b.openHour, b.closeHour)
      return { ...b, distanceKm: dist, ...status }
    })
    if (userCoords) {
      return [...list].sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
    }
    return list
  }, [userCoords])

  const nearestBranch = useMemo(() => {
    if (!userCoords) return null
    return branchesWithMeta[0] || null
  }, [userCoords, branchesWithMeta])

  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return branchesWithMeta
    const matches = branchesWithMeta.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.landmark.toLowerCase().includes(q)
    )
    return matches.length > 0 ? matches : branchesWithMeta
  }, [branchesWithMeta, searchQuery])

  const selectedBranch = useMemo(
    () => branchesWithMeta.find((b) => b.id === selectedBranchId) || branchesWithMeta[0],
    [branchesWithMeta, selectedBranchId]
  )

  // Initialize Leaflet Map
  useEffect(() => {
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return

        const map = L.map(mapContainerRef.current, {
          center: [14.585, 121.065],
          zoom: 11,
          zoomControl: false,
          attributionControl: true,
        })

        markersLayerRef.current = L.layerGroup().addTo(map)
        userLayerRef.current = L.layerGroup().addTo(map)

        map.on('zoomend', () => {
          setCurrentZoom(map.getZoom())
        })

        mapInstanceRef.current = map
        setMapReady(true)

        // Ensure proper sizing once mounted
        setTimeout(() => {
          map.invalidateSize()
        }, 180)
      })
      .catch(() => {
        setGeoStatusMsg('Map library could not be reached. Check internet connection.')
      })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Attempt silent geolocation on mount if permission was already granted
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.geolocation) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((res) => {
          if (res.state === 'granted') {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setUserCoords({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  label: 'Your Current Location',
                })
              },
              () => {}
            )
          }
        })
        .catch(() => {})
    }
  }, [])

  // Switch Map Tile Layers: Satellite (default), Hybrid, Standard
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.L) return
    const L = window.L
    const map = mapInstanceRef.current

    tileLayersRef.current.forEach((layer) => map.removeLayer(layer))
    tileLayersRef.current = []

    if (mapMode === 'satellite') {
      const sat = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        }
      ).addTo(map)
      tileLayersRef.current.push(sat)
    } else if (mapMode === 'hybrid') {
      const sat = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Satellite Hybrid',
        }
      ).addTo(map)
      const roads = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.88 }
      ).addTo(map)
      const labels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.95 }
      ).addTo(map)
      tileLayersRef.current.push(sat, roads, labels)
    } else {
      const standard = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      }).addTo(map)
      tileLayersRef.current.push(standard)
    }
  }, [mapMode, mapReady])

  // Render Branch Pins & Dynamic Marker Clustering
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersLayerRef.current || !window.L) return
    const L = window.L
    const map = mapInstanceRef.current
    const group = markersLayerRef.current
    group.clearLayers()

    // Zoom-based marker clustering when zoomed out (zoom <= 10)
    const shouldCluster = currentZoom <= 10
    type ClusterBucket = { latSum: number; lngSum: number; items: typeof branchesWithMeta }
    const buckets: ClusterBucket[] = []

    if (shouldCluster) {
      const thresholdPx = 56
      branchesWithMeta.forEach((branch) => {
        const pt = map.latLngToContainerPoint([branch.lat, branch.lng])
        let added = false
        for (const bucket of buckets) {
          const centerLat = bucket.latSum / bucket.items.length
          const centerLng = bucket.lngSum / bucket.items.length
          const bucketPt = map.latLngToContainerPoint([centerLat, centerLng])
          const distPx = Math.hypot(pt.x - bucketPt.x, pt.y - bucketPt.y)
          if (distPx < thresholdPx) {
            bucket.items.push(branch)
            bucket.latSum += branch.lat
            bucket.lngSum += branch.lng
            added = true
            break
          }
        }
        if (!added) {
          buckets.push({ latSum: branch.lat, lngSum: branch.lng, items: [branch] })
        }
      })
    } else {
      branchesWithMeta.forEach((b) => buckets.push({ latSum: b.lat, lngSum: b.lng, items: [b] }))
    }

    buckets.forEach((bucket) => {
      if (bucket.items.length > 1) {
        const centerLat = bucket.latSum / bucket.items.length
        const centerLng = bucket.lngSum / bucket.items.length
        const clusterIcon = L.divIcon({
          className: 'wmk-custom-div-icon',
          html: `<div class="wmk-cluster-pin" title="${bucket.items.length} WashMyKicks branches">
                   <span>${bucket.items.length}</span>
                 </div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        })
        const clusterMarker = L.marker([centerLat, centerLng], { icon: clusterIcon })
        clusterMarker.on('click', () => {
          const bounds = L.latLngBounds(bucket.items.map((i) => [i.lat, i.lng]))
          map.flyToBounds(bounds.pad(0.35), { duration: 0.75, maxZoom: 13 })
        })
        group.addLayer(clusterMarker)
      } else {
        const branch = bucket.items[0]
        const isSelected = branch.id === selectedBranchId
        const isNearest = nearestBranch?.id === branch.id
        const pinIcon = L.divIcon({
          className: 'wmk-custom-div-icon',
          html: `
            <div class="wmk-map-pin-wrap ${isSelected ? 'is-selected' : ''}">
              ${isSelected ? '<span class="wmk-pin-pulse"></span>' : ''}
              <div class="wmk-map-pin">
                <span class="wmk-map-pin-dot">0${branch.id}</span>
              </div>
              <div class="wmk-map-pin-label ${mapMode === 'standard' ? 'light-mode' : ''}">
                ${isNearest ? '<em class="wmk-nearest-dot">★</em>' : ''}${branch.shortName}
              </div>
            </div>
          `,
          iconSize: [140, 56],
          iconAnchor: [70, 28],
        })

        const marker = L.marker([branch.lat, branch.lng], { icon: pinIcon })
        marker.on('click', () => {
          setSelectedBranchId(branch.id)
          setShowPinCard(true)
          map.flyTo([branch.lat, branch.lng], Math.max(map.getZoom(), 14), { duration: 0.75 })
        })
        group.addLayer(marker)
      }
    })
  }, [branchesWithMeta, selectedBranchId, nearestBranch, currentZoom, mapMode, mapReady])

  // Render User Location Marker & Dashed Line to Nearest Branch
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !userLayerRef.current || !window.L) return
    const L = window.L
    const layer = userLayerRef.current
    layer.clearLayers()

    if (!userCoords) return

    const userIcon = L.divIcon({
      className: 'wmk-custom-div-icon',
      html: `
        <div class="wmk-user-loc-wrap" title="${userCoords.label}">
          <span class="wmk-user-loc-ring"></span>
          <span class="wmk-user-loc-dot"></span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })

    const m = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
    layer.addLayer(m)

    if (nearestBranch) {
      const line = L.polyline(
        [
          [userCoords.lat, userCoords.lng],
          [nearestBranch.lat, nearestBranch.lng],
        ],
        {
          color: '#ef2620',
          weight: 2.5,
          dashArray: '6, 8',
          opacity: 0.9,
        }
      )
      layer.addLayer(line)
    }
  }, [userCoords, nearestBranch, mapReady])

  // Action: Focus on a specific branch
  const focusBranch = (branch: BranchLocation, zoomLevel = 15) => {
    setSelectedBranchId(branch.id)
    setShowPinCard(true)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([branch.lat, branch.lng], zoomLevel, { duration: 0.8 })
    }
  }

  // Action: Show My Location (Browser Geolocation)
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatusMsg('Geolocation is not supported by this browser.')
      return
    }
    setIsLocating(true)
    setGeoStatusMsg('Detecting your real-time GPS location...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setUserCoords({ lat, lng, label: 'Your Current Location' })
        setIsLocating(false)
        setGeoStatusMsg('')

        // Find closest branch immediately and fly to show user + nearest branch
        let best = BRANCH_LOCATIONS[0]
        let bestDist = Infinity
        BRANCH_LOCATIONS.forEach((b) => {
          const d = calculateDistanceKm(lat, lng, b.lat, b.lng)
          if (d < bestDist) {
            bestDist = d
            best = b
          }
        })
        setSelectedBranchId(best.id)
        setShowPinCard(true)

        if (mapInstanceRef.current && window.L) {
          const bounds = window.L.latLngBounds([
            [lat, lng],
            [best.lat, best.lng],
          ])
          mapInstanceRef.current.flyToBounds(bounds.pad(0.35), { duration: 0.9, maxZoom: 14 })
        }
      },
      () => {
        setIsLocating(false)
        // Helpful fallback if user denies browser prompt or runs via restricted file context
        setGeoStatusMsg('Location permission declined — type your city/street in the search box to calculate distance.')
      },
      { enableHighAccuracy: true, timeout: 9000 }
    )
  }

  // Action: Search Location (matches branch OR geocodes Philippine location via Nominatim)
  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return

    // Direct branch match first
    const directBranch = BRANCH_LOCATIONS.find(
      (b) =>
        b.name.toLowerCase().includes(q.toLowerCase()) ||
        b.shortName.toLowerCase().includes(q.toLowerCase())
    )
    if (directBranch) {
      focusBranch(directBranch, 15)
      return
    }

    // Geocode any location in the Philippines to compute nearest WashMyKicks branch
    try {
      setIsSearchingGeo(true)
      setGeoStatusMsg('')
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(q)}`
      )
      const data = await resp.json()
      setIsSearchingGeo(false)
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        setUserCoords({ lat, lng, label: `Searched: ${q}` })

        let best = BRANCH_LOCATIONS[0]
        let bestDist = Infinity
        BRANCH_LOCATIONS.forEach((b) => {
          const d = calculateDistanceKm(lat, lng, b.lat, b.lng)
          if (d < bestDist) {
            bestDist = d
            best = b
          }
        })
        setSelectedBranchId(best.id)
        setShowPinCard(true)

        if (mapInstanceRef.current && window.L) {
          const bounds = window.L.latLngBounds([
            [lat, lng],
            [best.lat, best.lng],
          ])
          mapInstanceRef.current.flyToBounds(bounds.pad(0.35), { duration: 0.9, maxZoom: 14 })
        }
      } else {
        setGeoStatusMsg(`No map location found for "${q}". Try a city or landmark in Metro Manila, Rizal, or Cavite.`)
      }
    } catch {
      setIsSearchingGeo(false)
      setGeoStatusMsg('Could not geocode search query right now.')
    }
  }

  const handleResetOverview = () => {
    if (mapInstanceRef.current && window.L) {
      const bounds = window.L.latLngBounds(BRANCH_LOCATIONS.map((b) => [b.lat, b.lng]))
      mapInstanceRef.current.flyToBounds(bounds.pad(0.18), { duration: 0.8 })
    }
  }

  const getDirectionsUrl = (branch: BranchLocation) => {
    const dest = `${branch.lat},${branch.lng}`
    if (userCoords) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${dest}&travelmode=driving`
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
  }

  return (
    <div className="wmk-locator-wrapper">
      <div className="wmk-locator-shell">
        {/* 1. SEARCH BAR & NEAREST BRANCH HEADER (Order 1 on Mobile, Left-Top on Desktop) */}
        <div className="wmk-locator-search-pane">
          <form className="wmk-locator-search-form" onSubmit={handleLocationSearch}>
            <Search size={16} className="wmk-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city, street, or WashMyKicks branch..."
              aria-label="Search branch or location"
            />
            {searchQuery && (
              <button
                type="button"
                className="wmk-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" className="wmk-search-go" disabled={isSearchingGeo}>
              {isSearchingGeo ? '...' : 'Find'}
            </button>
          </form>

          <div className="wmk-locator-quickbar">
            <button
              type="button"
              className="wmk-my-location-pill"
              onClick={handleDetectLocation}
              disabled={isLocating}
            >
              <LocateFixed size={14} />
              <span>{isLocating ? 'Locating...' : userCoords ? 'Update My Location' : 'Use My Location'}</span>
            </button>
            <button type="button" className="wmk-reset-view-pill" onClick={handleResetOverview}>
              <Compass size={14} /> All 7 Branches
            </button>
          </div>

          {geoStatusMsg && <div className="wmk-geo-alert">{geoStatusMsg}</div>}

          {/* Real-Time Nearest Branch Banner when customer location is detected */}
          {nearestBranch && userCoords && (
            <div className="wmk-nearest-banner" onClick={() => focusBranch(nearestBranch, 15)}>
              <div className="wmk-nearest-top">
                <span className="wmk-nearest-tag">
                  <Sparkles size={11} /> {userCoords.label.toUpperCase()}
                </span>
                <span className="wmk-nearest-dist">{nearestBranch.distanceKm} km</span>
              </div>
              <div className="wmk-nearest-name">Nearest Branch: {nearestBranch.name}</div>
              <div className="wmk-nearest-addr">{nearestBranch.address}</div>
            </div>
          )}
        </div>

        {/* 2. INTERACTIVE SATELLITE MAP STAGE (Order 2 on Mobile, Right Column on Desktop) */}
        <div className="wmk-locator-map-pane">
          {/* Top-Left Map Mode Switcher: Satellite (Default) | Hybrid | Standard */}
          <div className="wmk-map-mode-bar" role="group" aria-label="Map view mode">
            <Layers size={14} className="wmk-mode-icon" />
            {(
              [
                ['satellite', 'Satellite'],
                ['hybrid', 'Hybrid'],
                ['standard', 'Standard'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={mapMode === mode ? 'active' : ''}
                onClick={() => setMapMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right-Side Floating Map Controls (Zoom In, Zoom Out, My Location, Focus Branch, Fit All) */}
          <div className="wmk-map-controls" aria-label="Map navigation controls">
            <button
              type="button"
              title="Show My Location"
              onClick={handleDetectLocation}
              className={userCoords ? 'active-loc' : ''}
            >
              <Crosshair size={17} />
            </button>
            <button
              type="button"
              title="Zoom In"
              onClick={() => mapInstanceRef.current?.zoomIn()}
            >
              <Plus size={17} />
            </button>
            <button
              type="button"
              title="Zoom Out"
              onClick={() => mapInstanceRef.current?.zoomOut()}
            >
              <Minus size={17} />
            </button>
            <button
              type="button"
              title="Focus on Selected Branch"
              onClick={() => focusBranch(selectedBranch, 16)}
            >
              <MapPin size={16} />
            </button>
            <button
              type="button"
              title="View All Branches"
              onClick={handleResetOverview}
            >
              <Compass size={16} />
            </button>
          </div>

          {/* Leaflet Map Canvas */}
          <div ref={mapContainerRef} className="wmk-leaflet-canvas" />

          {/* Selected Pin Interactive Branch Card Overlay */}
          {showPinCard && selectedBranch && (
            <aside className="wmk-pin-card" aria-live="polite">
              <button
                type="button"
                className="wmk-pin-card-close"
                onClick={() => setShowPinCard(false)}
                aria-label="Close branch card"
              >
                <X size={15} />
              </button>

              <div className="wmk-pin-card-badges">
                <span className={`wmk-open-pill ${selectedBranch.isOpen ? 'open' : 'closed'}`}>
                  ● {selectedBranch.statusText}
                </span>
                {selectedBranch.distanceKm !== null && (
                  <span className="wmk-dist-pill">{selectedBranch.distanceKm} km away</span>
                )}
              </div>

              <h3>{selectedBranch.name}</h3>
              <p className="wmk-pin-addr">
                <MapPin size={13} /> {selectedBranch.address}
              </p>

              <div className="wmk-pin-meta-grid">
                <span>
                  <Phone size={12} /> {selectedBranch.phone}
                </span>
                <span>
                  <Clock3 size={12} /> {selectedBranch.hoursLabel}
                </span>
              </div>

              <div className="wmk-pin-services">
                {selectedBranch.services.map((svc) => (
                  <span key={svc} className="wmk-svc-chip">
                    {svc}
                  </span>
                ))}
              </div>

              <div className="wmk-pin-actions">
                <a
                  href={getDirectionsUrl(selectedBranch)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="outline wmk-btn-sm"
                >
                  <Navigation size={13} /> Get Directions
                </a>
                <button
                  type="button"
                  className="primary wmk-btn-sm"
                  onClick={() => onBookBranch(selectedBranch.name, selectedBranch.id)}
                >
                  <Calendar size={13} /> Book Appointment
                </button>
                <button
                  type="button"
                  className="outline wmk-btn-sm"
                  onClick={() => setDetailsModalBranch(selectedBranch)}
                >
                  <Info size={13} /> View Details
                </button>
              </div>
            </aside>
          )}
        </div>

        {/* 3. SCROLLABLE BRANCH LIST (Order 3 on Mobile, Left-Bottom on Desktop) */}
        <div className="wmk-locator-list-pane">
          <div className="wmk-list-count">
            <span>{filteredBranches.length} ACTIVE LOCATIONS</span>
            <span>{mapMode.toUpperCase()} VIEW</span>
          </div>

          <div className="wmk-branch-scroll">
            {filteredBranches.map((branch) => {
              const isSelected = branch.id === selectedBranchId
              const isNearest = nearestBranch?.id === branch.id
              return (
                <article
                  key={branch.id}
                  className={`wmk-locator-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => focusBranch(branch, 15)}
                >
                  <div className="wmk-item-top">
                    <span className="wmk-item-idx">0{branch.id}</span>
                    <div className="wmk-item-badges">
                      {isNearest && <span className="wmk-nearest-chip">NEAREST</span>}
                      {branch.distanceKm !== null && (
                        <span className="wmk-km-chip">{branch.distanceKm} km</span>
                      )}
                    </div>
                  </div>

                  <h4>{branch.name}</h4>
                  <p>{branch.address}</p>

                  <div className="wmk-item-status-row">
                    <span className={branch.isOpen ? 'open-txt' : 'closed-txt'}>
                      ● {branch.statusText}
                    </span>
                  </div>

                  <div className="wmk-item-btns" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="primary wmk-mini-cta"
                      onClick={() => onBookBranch(branch.name, branch.id)}
                    >
                      Book Appointment <ArrowRight size={12} />
                    </button>
                    <a
                      href={getDirectionsUrl(branch)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wmk-mini-link"
                    >
                      Directions <ExternalLink size={11} />
                    </a>
                    <button
                      type="button"
                      className="wmk-mini-link"
                      onClick={() => setDetailsModalBranch(branch)}
                    >
                      Details
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>

      {/* BRANCH FULL DETAILS MODAL */}
      {detailsModalBranch && (
        <div className="wmk-modal-backdrop" onClick={() => setDetailsModalBranch(null)}>
          <div className="wmk-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <span className="eyebrow">BRANCH 0{detailsModalBranch.id} · WASHMYKICKS NETWORK</span>
                <h2 style={{ fontSize: 24, margin: '6px 0', letterSpacing: '-0.8px' }}>
                  {detailsModalBranch.name}
                </h2>
              </div>
              <button type="button" onClick={() => setDetailsModalBranch(null)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            <div style={{ margin: '10px 0 18px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span
                className={`wmk-open-pill ${
                  getBranchOpenStatus(detailsModalBranch.openHour, detailsModalBranch.closeHour).isOpen
                    ? 'open'
                    : 'closed'
                }`}
              >
                ● {getBranchOpenStatus(detailsModalBranch.openHour, detailsModalBranch.closeHour).statusText}
              </span>
              <span className="wmk-dist-pill">{detailsModalBranch.city}</span>
            </div>

            <div className="wmk-modal-info-box">
              <div>
                <b>Full Street Address</b>
                <p>{detailsModalBranch.address}</p>
              </div>
              <div>
                <b>Landmark & Access</b>
                <p>{detailsModalBranch.landmark}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <b>Contact Number</b>
                  <p>
                    <a href={`tel:${detailsModalBranch.phone.replace(/\s+/g, '')}`} style={{ color: '#dc2626', fontWeight: 700 }}>
                      {detailsModalBranch.phone}
                    </a>
                  </p>
                </div>
                <div>
                  <b>Business Hours</b>
                  <p>{detailsModalBranch.hoursLabel}</p>
                </div>
              </div>
              <div>
                <b>Specialist Capabilities</b>
                <p>{detailsModalBranch.turnaroundNote}</p>
              </div>
            </div>

            <div style={{ margin: '16px 0' }}>
              <b style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#6b7280', display: 'block', marginBottom: 8 }}>
                Available Services at this Branch
              </b>
              <div className="wmk-pin-services">
                {detailsModalBranch.services.map((s) => (
                  <span key={s} className="wmk-svc-chip">
                    <CheckCircle2 size={12} color="#059669" /> {s}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  const chosen = detailsModalBranch
                  setDetailsModalBranch(null)
                  onBookBranch(chosen.name, chosen.id)
                }}
              >
                Book Appointment at {detailsModalBranch.shortName} <ArrowRight size={15} />
              </button>
              <a
                href={getDirectionsUrl(detailsModalBranch)}
                target="_blank"
                rel="noopener noreferrer"
                className="outline"
              >
                <Navigation size={14} /> Get Directions
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
