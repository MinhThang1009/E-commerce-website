/**
 * @file AddressPicker.tsx
 * @layer Component
 * @feature shared
 * @description Địa chỉ giao hàng — cascade Tỉnh → Quận → Phường + số nhà/đường
 *   Data hành chính: provinces.open-api.vn (free, không cần key)
 *   Geocoding: Goong.io (lat/lng từ địa chỉ đầy đủ)
 *   Bản đồ: Leaflet + OpenStreetMap
 */
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

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_CENTER: [number, number] = [21.0278, 105.8342];
const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY as string;
const GOONG_BASE = 'https://rsapi.goong.io';
const VN_API = 'https://provinces.open-api.vn/api';

// ── Interfaces ────────────────────────────────────────────────────────────────
interface AdminUnit {
  code: number;
  name: string;
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildFullAddress(
  street: string,
  ward: string,
  district: string,
  province: string,
): string {
  return [street, ward, district, province].filter(Boolean).join(', ');
}

// ── Component ─────────────────────────────────────────────────────────────────
const AddressPicker: React.FC<AddressPickerProps> = ({
  label,
  value,
  onChange,
  error,
  required,
}) => {
  const { t } = useTranslation();
  const labelText = label ?? t('addressPicker.label');

  // Cascade state
  const [provinces, setProvinces] = useState<AdminUnit[]>([]);
  const [districts, setDistricts] = useState<AdminUnit[]>([]);
  const [wards, setWards] = useState<AdminUnit[]>([]);

  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState('');
  const [street, setStreet] = useState('');

  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const geocodeRef = useRef<ReturnType<typeof setTimeout>>();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Load danh sách tỉnh/thành phố một lần
  useEffect(() => {
    fetch(`${VN_API}/p/`)
      .then((r) => r.json())
      .then((data: AdminUnit[]) => setProvinces(data))
      .catch(() => {});
  }, []);

  // Load quận/huyện khi chọn tỉnh
  useEffect(() => {
    if (!selectedProvinceCode) {
      setDistricts([]);
      setWards([]);
      return;
    }
    setLoadingDistricts(true);
    setDistricts([]);
    setSelectedDistrict('');
    setSelectedDistrictCode(null);
    setWards([]);
    setSelectedWard('');
    fetch(`${VN_API}/p/${selectedProvinceCode}?depth=2`)
      .then((r) => r.json())
      .then((data) => setDistricts(data.districts ?? []))
      .catch(() => {})
      .finally(() => setLoadingDistricts(false));
  }, [selectedProvinceCode]);

  // Load phường/xã khi chọn quận
  useEffect(() => {
    if (!selectedDistrictCode) {
      setWards([]);
      return;
    }
    setLoadingWards(true);
    setWards([]);
    setSelectedWard('');
    fetch(`${VN_API}/d/${selectedDistrictCode}?depth=2`)
      .then((r) => r.json())
      .then((data) => setWards(data.wards ?? []))
      .catch(() => {})
      .finally(() => setLoadingWards(false));
  }, [selectedDistrictCode]);

  // Khởi tạo Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { center: DEFAULT_CENTER, zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    markerRef.current = L.marker(DEFAULT_CENTER).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Geocode địa chỉ đầy đủ → cập nhật map + gọi onChange
  const geocodeAndNotify = useCallback(
    (fullAddress: string, ward: string, district: string, province: string) => {
      if (geocodeRef.current) clearTimeout(geocodeRef.current);
      onChange(fullAddress); // Cập nhật ngay text

      if (!fullAddress.trim()) return;

      geocodeRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `${GOONG_BASE}/Geocode?address=${encodeURIComponent(fullAddress)}&api_key=${GOONG_API_KEY}`,
          );
          const data = await res.json();
          const loc = data.results?.[0]?.geometry?.location;
          if (loc) {
            markerRef.current?.setLatLng([loc.lat, loc.lng]);
            mapRef.current?.setView([loc.lat, loc.lng], 16);
            onChange(fullAddress, String(loc.lat), String(loc.lng), {
              city: district,
              state: province,
              country: 'Việt Nam',
            });
          }
        } catch {
          /* bỏ qua lỗi geocode */
        }
      }, 600);
    },
    [onChange],
  );

  // Khi bất kỳ field nào thay đổi → rebuild full address
  // Chỉ geocode khi có đủ tỉnh + quận + phường + số nhà
  const handleChange = useCallback(
    (
      newStreet = street,
      newWard = selectedWard,
      newDistrict = selectedDistrict,
      newProvince = selectedProvince,
    ) => {
      const full = buildFullAddress(newStreet, newWard, newDistrict, newProvince);
      const isComplete = !!(newProvince && newDistrict && newStreet.trim());
      if (isComplete) {
        geocodeAndNotify(full, newDistrict, newProvince, newProvince);
      } else {
        // Chưa đủ → reset value về rỗng để validation bắt được
        geocodeAndNotify('', '', '', newProvince);
      }
    },
    [street, selectedWard, selectedDistrict, selectedProvince, geocodeAndNotify],
  );

  const selectClass =
    'w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 ' +
    'text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 ' +
    'focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-3">
      {label !== undefined && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {labelText}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Tỉnh / Thành phố */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
          {t('addressPicker.province')}
        </label>
        <select
          className={selectClass}
          value={selectedProvinceCode ?? ''}
          onChange={(e) => {
            const code = Number(e.target.value);
            const name = provinces.find((p) => p.code === code)?.name ?? '';
            setSelectedProvinceCode(code || null);
            setSelectedProvince(name);
            handleChange(street, selectedWard, selectedDistrict, name);
          }}
        >
          <option value="">{t('addressPicker.selectProvince')}</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Quận / Huyện */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
          {t('addressPicker.district')}
        </label>
        <select
          className={selectClass}
          value={selectedDistrictCode ?? ''}
          disabled={!selectedProvinceCode || loadingDistricts}
          onChange={(e) => {
            const code = Number(e.target.value);
            const name = districts.find((d) => d.code === code)?.name ?? '';
            setSelectedDistrictCode(code || null);
            setSelectedDistrict(name);
            handleChange(street, selectedWard, name, selectedProvince);
          }}
        >
          <option value="">
            {loadingDistricts ? t('addressPicker.loading') : t('addressPicker.selectDistrict')}
          </option>
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Phường / Xã */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
          {t('addressPicker.ward')}
        </label>
        <select
          className={selectClass}
          value={selectedWard}
          disabled={!selectedDistrictCode || loadingWards}
          onChange={(e) => {
            setSelectedWard(e.target.value);
            handleChange(street, e.target.value, selectedDistrict, selectedProvince);
          }}
        >
          <option value="">
            {loadingWards ? t('addressPicker.loading') : t('addressPicker.selectWard')}
          </option>
          {wards.map((w) => (
            <option key={w.code} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {/* Số nhà, tên đường */}
      <Input
        label={t('addressPicker.streetLabel')}
        value={street}
        onChange={(e) => {
          setStreet(e.target.value);
          handleChange(e.target.value, selectedWard, selectedDistrict, selectedProvince);
        }}
        placeholder={t('addressPicker.streetPlaceholder')}
        autoComplete="off"
      />

      {/* Error hiển thị ở cuối section — chỉ khi có lỗi từ form validation */}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Địa chỉ đầy đủ (readonly preview) */}
      {value && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded px-3 py-2">
          📍 {value}
        </p>
      )}

      {/* Bản đồ */}
      <div
        ref={mapContainerRef}
        style={{ height: '220px', width: '100%', borderRadius: '8px', zIndex: 0 }}
      />
    </div>
  );
};

export default AddressPicker;
