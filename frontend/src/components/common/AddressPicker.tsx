import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Input from './Input';

interface LocationSuggestion {
  display_name: string;
  lat?: string;
  lon?: string;
}

interface AddressPickerProps {
  label?: string;
  value: string;
  onChange: (value: string, lat?: string, lon?: string) => void;
  error?: string;
  required?: boolean;
}

const AddressPicker: React.FC<AddressPickerProps> = ({
  label,
  value,
  onChange,
  error,
  required
}) => {
  const { t } = useTranslation();
  const labelText = label ?? t('addressPicker.label');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!value || value.length < 3) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';
        const res = await axios.get(`${apiBase}/location/search?text=${encodeURIComponent(value)}`);
        if (res.data?.data) {
          setSuggestions(res.data.data);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Lỗi khi tải gợi ý địa chỉ:", err);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      if (showDropdown) fetchSuggestions();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [value, showDropdown]);

  const handleSelect = (suggestion: LocationSuggestion) => {
    onChange(suggestion.display_name, suggestion.lat, suggestion.lon);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
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
      
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-auto top-full -mt-2">
          {loading && <li className="px-4 py-2 text-neutral-500">{t('addressPicker.searching')}</li>}
          {!loading && suggestions.map((item, index) => (
            <li
              key={index}
              onClick={() => handleSelect(item)}
              className="px-4 py-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-700 text-sm text-neutral-800 dark:text-neutral-200"
            >
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressPicker;

