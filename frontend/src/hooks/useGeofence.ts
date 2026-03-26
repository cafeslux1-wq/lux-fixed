import { useState, useEffect, useRef, useCallback } from 'react';

export interface GeofenceState { status: 'idle'|'requesting'|'inside'|'outside'|'denied'|'unavailable'|'error'; lat: number|null; lng: number|null; accuracyM: number|null; distanceM: number|null; isInside: boolean; errorMsg: string|null; isLoading: boolean }
interface BranchTarget { lat: number; lng: number; radiusM: number }

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000, φ1 = lat1*Math.PI/180, φ2 = lat2*Math.PI/180, Δφ = (lat2-lat1)*Math.PI/180, Δλ = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function useGeofence(target: BranchTarget | null) {
  const [state, setState] = useState<GeofenceState>({ status:'idle', lat:null, lng:null, accuracyM:null, distanceM:null, isInside:false, errorMsg:null, isLoading:false });
  const watchIdRef = useRef<number | null>(null);
  const check = useCallback(() => {
    if (!navigator.geolocation) { setState(s => ({ ...s, status:'unavailable', errorMsg:'GPS non disponible' })); return; }
    setState(s => ({ ...s, status:'requesting', isLoading:true, errorMsg:null }));
    watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      let distanceM: number|null = null; let isInside = !target;
      if (target) { distanceM = haversineM(latitude, longitude, target.lat, target.lng); isInside = distanceM <= target.radiusM; }
      setState({ status: isInside ? 'inside' : 'outside', lat: latitude, lng: longitude, accuracyM: accuracy, distanceM: distanceM ? parseFloat(distanceM.toFixed(1)) : null, isInside, errorMsg: isInside ? null : `Vous êtes à ${distanceM?.toFixed(0)}m (max ${target?.radiusM}m)`, isLoading: false });
    }, (err) => {
      const msgs: Record<number, string> = { 1:'Accès GPS refusé.', 2:'Position GPS indisponible.', 3:'Délai GPS dépassé.' };
      setState(s => ({ ...s, status: err.code===1 ? 'denied' : 'error', errorMsg: msgs[err.code] || 'Erreur GPS', isLoading: false }));
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:5000 });
  }, [target]);
  useEffect(() => () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);
  return { ...state, startTracking: check };
}
