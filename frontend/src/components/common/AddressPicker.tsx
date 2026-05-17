import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Input from './Input';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER: [number, number] = [21.0278, 105.8342];
const PHOTON_URL = 'https://photon.komoot.io/api';
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';

export interface AddressDetail {
  city?: string;
  state?: string;
  country?: string;
}

interface AddressPickerProps {
  label?: string;
  value: string;
  onChange: (value: string, lat?: string, lon?: string, detail?: AddressDetail) => void;
  error?: string;
  required?: boolean;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
  };
}

function formatAddress(props: PhotonFeature['properties']): string {
  const parts: string[] = [];
  if (props.housenumber && props.street) {
    parts.push(`${props.housenumber} ${props.street}`);
  } else if (props.street) {
    parts.push(props.street);
  } else if (props.name) {
    parts.push(props.name);
  }
  if (props.district) parts.push(props.district);
  if (props.city) parts.push(props.city);
  if (props.state && props.state !== props.city) parts.push(props.state);
  if (props.country) parts.push(props.country);
  return parts.join(', ') || props.name || '';
}

function extractDetail(props: PhotonFeature['properties']): AddressDetail {
  return {
    city: props.district || props.city,
    state: props.state || props.city,
    country: props.country,
  };
}

const AddressPicker: React.FC<AddressPickerProps> = ({
  label,
  value,
  onChange,
  error,
  required,
}) => {
  const { t } = useTranslation();
  const labelText = label ?? t('addressPicker.label');

  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Khởi tạo Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const marker = L.marker(DEFAULT_CENTER).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Click trên map → reverse geocode
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      markerRef.current?.setLatLng([lat, lng]);
      mapRef.current?.setView([lat, lng]);

      try {
        const res = await fetch(`${PHOTON_REVERSE_URL}?lat=${lat}&lon=${lng}`);
        const data = await res.json();
        const feature = data.features?.[0] as PhotonFeature | undefined;

        if (feature) {
          const address = formatAddress(feature.properties);
          const detail = extractDetail(feature.properties);
          onChange(address, String(lat), String(lng), detail);
        } else {
          onChange(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, String(lat), String(lng));
        }
      } catch {
        onChange(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, String(lat), String(lng));
      }
    },
    [onChange],
  );

  // Bind click event sau khi map và handler sẵn sàng
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      handleMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [handleMapClick]);

  // Click outside → đóng dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search qua Photon
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value || value.length < 3 || !showDropdown) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${PHOTON_URL}?q=${encodeURIComponent(value)}&limit=5&bbox=102.14,8.18,109.46,23.39`,
        );
        const data = await res.json();
        setSuggestions(data.features ?? []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Lỗi tìm kiếm địa chỉ:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, showDropdown]);

  const handleSelect = useCallback(
    (feature: PhotonFeature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const address = formatAddress(feature.properties);
      const detail = extractDetail(feature.properties);

      markerRef.current?.setLatLng([lat, lng]);
      mapRef.current?.setView([lat, lng], 16);

      setShowDropdown(false);
      onChange(address, String(lat), String(lng), detail);
    },
    [onChange],
  );

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <div className="relative">
        <Input
          label={labelText}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          error={error}
          required={required}
          placeholder={t('addressPicker.placeholder')}
          autoComplete="off"
        />

        {showDropdown && (suggestions.length > 0 || loading) && (
          <ul className="absolute z-[1000] w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-auto top-full mt-1">
            {loading && (
              <li className="px-4 py-2 text-neutral-500 text-sm">{t('addressPicker.searching')}</li>
            )}
            {!loading &&
              suggestions.map((feat, idx) => (
                <li
                  key={idx}
                  onClick={() => handleSelect(feat)}
                  className="px-4 py-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-700 text-sm text-neutral-800 dark:text-neutral-200"
                >
                  {formatAddress(feat.properties)}
                </li>
              ))}
          </ul>
        )}
      </div>

      <div
        ref={mapContainerRef}
        style={{ height: '260px', width: '100%', borderRadius: '8px', zIndex: 0 }}
      />
    </div>
  );
};

export default AddressPicker;
