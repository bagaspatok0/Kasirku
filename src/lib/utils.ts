import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface StoreInfo {
  name: string;
  address: string;
  phone: string;
  footer: string;
  mapsLink?: string;
  wifiName?: string;
  wifiPassword?: string;
}

export function getStoreInfo(): StoreInfo {
  const saved = localStorage.getItem('store_info');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        name: parsed.name || 'KasirKu',
        address: parsed.address || 'Jl. Contoh No. 123, Kota',
        phone: parsed.phone || '0812-3456-7890',
        footer: parsed.footer || 'Selamat Belanja Kembali',
        mapsLink: parsed.mapsLink || '',
        wifiName: parsed.wifiName || '',
        wifiPassword: parsed.wifiPassword || ''
      };
    } catch (e) {
      // Ignore
    }
  }
  return {
    name: 'KasirKu',
    address: 'Jl. Contoh No. 123, Kota',
    phone: '0812-3456-7890',
    footer: 'Selamat Belanja Kembali',
    mapsLink: '',
    wifiName: '',
    wifiPassword: ''
  };
}

export function saveStoreInfo(info: StoreInfo) {
  localStorage.setItem('store_info', JSON.stringify(info));
}

