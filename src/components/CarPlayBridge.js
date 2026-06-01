// Headless bridge that activates CarPlay projection when the user is Premium.
// Renders nothing; lives inside AppProvider so it can read app state. No-ops
// entirely in Expo Go / non-CarPlay builds (carPlaySupported() returns false).
import { useEffect, useRef } from 'react';
import { useApp } from '../state/AppContext';
import {
  carPlaySupported,
  initCarPlay,
  refreshCarPlay,
  teardownCarPlay,
} from '../services/carplay';

export default function CarPlayBridge() {
  const { premium, stations, location, planAndSetRoute } = useApp();

  // Keep latest data reachable from the CarPlay callbacks without re-init.
  const stationsRef = useRef(stations);
  const locationRef = useRef(location);
  stationsRef.current = stations;
  locationRef.current = location;

  // Activate / tear down with the premium flag.
  useEffect(() => {
    if (!premium || !carPlaySupported()) return undefined;
    initCarPlay({
      getStations: () => stationsRef.current,
      getLocation: () => locationRef.current,
      // Selecting a station on the car screen plans a route on the phone
      // (always via the most efficient charging stop — planAndSetRoute).
      onNavigate: (s) => {
        planAndSetRoute({ lat: s.lat, lng: s.lng, name: s.name });
      },
    });
    return () => teardownCarPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premium]);

  // Push fresh stations to the car screen as they load/change.
  useEffect(() => {
    if (premium && carPlaySupported()) refreshCarPlay();
  }, [premium, stations]);

  return null;
}
