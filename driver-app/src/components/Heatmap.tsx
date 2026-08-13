import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, Navigation } from 'lucide-react';
import { useDriver } from '../context/DriverContext';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char] || char));

interface HeatmapProps {
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  heightClass?: string;
}

export const Heatmap: React.FC<HeatmapProps> = ({
  isFullScreen = false,
  onToggleFullScreen,
  heightClass = 'h-[320px]',
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersGroup = useRef<L.LayerGroup | null>(null);
  const { hotspots, driverLocation, activeOrder, isOnline } = useDriver();
  const [internalFullScreen, setInternalFullScreen] = useState(false);
  const initialCenter = driverLocation || activeOrder?.pickupCoords || (hotspots[0] ? [hotspots[0].lat, hotspots[0].lng] as [number, number] : [22.8710, 91.0996] as [number, number]);
  const [centerLat, centerLng] = initialCenter;

  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      // Initialize Leaflet map
      const map = L.map(mapRef.current, {
        center: [centerLat, centerLng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // CartoDB Dark Matter tile layer for dark theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      markersGroup.current = L.layerGroup().addTo(map);
      leafletMap.current = map;
    }

    const map = leafletMap.current;
    if (markersGroup.current) {
      markersGroup.current.clearLayers();
    }

    // Render Hotspots (matching pink numbered badges in screenshot)
    hotspots.forEach((spot) => {
      const hotspotIcon = L.divIcon({
        className: 'custom-hotspot-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-2 bg-pink-500/30 rounded-full animate-ping"></div>
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-pink-600 border-2 border-pink-300 text-white font-bold text-xs shadow-lg shadow-pink-900/50">
              <svg class="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>
            </div>
            <div class="absolute -bottom-4 bg-zinc-900/90 text-pink-300 text-[9px] px-1.5 py-0.5 rounded border border-pink-500/30 whitespace-nowrap">
              ${escapeHtml(spot.surgeMultiplier)}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([spot.lat, spot.lng], { icon: hotspotIcon }).addTo(markersGroup.current!);

      // Heat circle around hotspot
      L.circleMarker([spot.lat, spot.lng], {
        radius: 28,
        color: '#E11D48',
        fillColor: '#E11D48',
        fillOpacity: 0.25,
        weight: 1.5,
      }).addTo(markersGroup.current!);
    });

    // Render Driver Location Pin
    const driverIcon = L.divIcon({
      className: 'driver-location-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-3 ${isOnline ? 'bg-pink-500/40' : 'bg-blue-500/30'} rounded-full animate-pulse"></div>
          <div class="w-9 h-9 rounded-full ${isOnline ? 'bg-pink-600 border-2 border-white' : 'bg-zinc-800 border-2 border-zinc-500'} flex items-center justify-center text-white shadow-xl">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (driverLocation) {
      L.marker(driverLocation, { icon: driverIcon }).addTo(markersGroup.current!);
    }

    // Render Active Order route polyline if present
    if (activeOrder) {
      const pickup = activeOrder.pickupCoords;
      const dropoff = activeOrder.dropoffCoords;

      // Pickup Marker
      const pickupIcon = L.divIcon({
        className: 'pickup-marker',
        html: `
          <div class="bg-pink-600 text-white font-bold text-[10px] px-2 py-1 rounded-md border border-pink-300 shadow-md flex items-center gap-1">
            <span>🍕</span>
            <span>${escapeHtml(activeOrder.restaurantName.substring(0, 10))}...</span>
          </div>
        `,
        iconSize: [90, 24],
        iconAnchor: [45, 12],
      });

      if (pickup) L.marker(pickup, { icon: pickupIcon }).addTo(markersGroup.current!);

      // Dropoff Marker
      const dropoffIcon = L.divIcon({
        className: 'dropoff-marker',
        html: `
          <div class="bg-blue-600 text-white font-bold text-[10px] px-2 py-1 rounded-md border border-blue-300 shadow-md flex items-center gap-1">
            <span>🏠</span>
            <span>${escapeHtml(activeOrder.customerName.substring(0, 8))}...</span>
          </div>
        `,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });

      if (dropoff) L.marker(dropoff, { icon: dropoffIcon }).addTo(markersGroup.current!);

      // Pink Route Polyline
      const routePoints = [driverLocation, pickup, dropoff].filter((point): point is [number, number] => Array.isArray(point));

      if (routePoints.length > 1) {
        L.polyline(routePoints, {
          color: '#E11D48', weight: 5, opacity: 0.85, dashArray: '10, 8',
        }).addTo(markersGroup.current!);
        map.fitBounds(L.polyline(routePoints).getBounds(), { padding: [40, 40] });
      } else if (routePoints.length === 1) {
        map.setView(routePoints[0], 14);
      }
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

  }, [hotspots, driverLocation, activeOrder, isOnline, centerLat, centerLng]);

  const toggleExpand = () => {
    if (onToggleFullScreen) {
      onToggleFullScreen();
    } else {
      setInternalFullScreen(!internalFullScreen);
    }
    setTimeout(() => {
      leafletMap.current?.invalidateSize();
    }, 200);
  };

  const isExpanded = isFullScreen || internalFullScreen;

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-zinc-800/80 shadow-2xl transition-all duration-300 ${
        isExpanded ? 'fixed inset-0 z-50 rounded-none h-full' : heightClass
      }`}
    >
      {/* Map container */}
      <div ref={mapRef} className="w-full h-full bg-zinc-900" />

      {/* Map overlay gradient */}
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-zinc-950/80 to-transparent pointer-events-none z-10" />

      {/* Expand / Collapse Control Button */}
      <button
        id="btn-map-expand"
        onClick={toggleExpand}
        className="absolute top-3 right-3 z-20 bg-zinc-900/90 text-zinc-200 hover:text-white p-2 rounded-xl border border-zinc-700/80 shadow-lg backdrop-blur-md transition-all active:scale-95"
        title={isExpanded ? 'Minimize map' : 'Expand full map view'}
      >
        {isExpanded ? <Minimize2 className="w-4 h-4 text-pink-400" /> : <Maximize2 className="w-4 h-4 text-pink-400" />}
      </button>

      {/* Recenter Location Button */}
      <button
        id="btn-map-recenter"
        onClick={() => {
          leafletMap.current?.setView([centerLat, centerLng], 14);
        }}
        className="absolute bottom-3 right-3 z-20 bg-zinc-900/90 text-zinc-200 hover:text-white p-2 rounded-xl border border-zinc-700/80 shadow-lg backdrop-blur-md transition-all active:scale-95"
        title="Recenter location"
      >
        <Navigation className="w-4 h-4 text-pink-400" />
      </button>
    </div>
  );
};
