// ─── CAFÉ LUX — Constants & Fallback Data ────────────────────────────
import type { Coupon, MenuCategory } from './types';

export const CAFE = {
  name:      'Café LUX',
  tagline:   'Café & Pâtisserie',
  city:      'Taza, Maroc',
  phone:     '+212808524169',
  whatsapp:  '+212808524169',
  address:   'Résidence Ziat N28, Taza',
  hours:     '07:00 – 23:00',
  lat:       34.2100,
  lng:       -3.9990,
  gpsRadius: 500, // metres for staff check-in
  website:   'https://cafeslux.com',
  apiBase:   import.meta.env.VITE_API_URL ?? 'https://YOUR-RAILWAY-BACKEND.up.railway.app',
} as const;

export const DELIVERY = {
  fee:          15,   // MAD
  freeThreshold: 200, // MAD — free above this
  etaMin:       30,
  etaMax:       45,
} as const;

export const TVA = 0.10; // 10%

// ─── LOYALTY LEVELS ───────────────────────────────────────────────────
export const LOYALTY_LEVELS = [
  {
    id: 'bronze', name: 'Bronze', icon: '🥉', color: '#B06438',
    min: 0,   max: 99,
    perks: ['1 pt / 10 MAD dépensé', 'Accès offres de base'],
  },
  {
    id: 'silver', name: 'Silver', icon: '🥈', color: '#A0A0B4',
    min: 100, max: 299,
    perks: ['Tout Bronze', '-5% tous les 10 achats', 'Offres Silver'],
  },
  {
    id: 'gold', name: 'Gold', icon: '🥇', color: '#C9A84C',
    min: 300, max: 599,
    perks: ['Tout Silver', 'Boisson offerte / 200 pts', 'Réservation prioritaire', 'Événements privés'],
  },
  {
    id: 'diamond', name: 'Diamond', icon: '💎', color: '#5B8DEF',
    min: 600, max: Infinity,
    perks: ['Tout Gold', 'Livraison GRATUITE toujours', 'Cadeau anniversaire', '-10% permanent'],
  },
] as const;

export const getLoyaltyLevel = (pts: number) =>
  [...LOYALTY_LEVELS].reverse().find(l => pts >= l.min) ?? LOYALTY_LEVELS[0];

// ─── DEFAULT COUPONS (LS fallback) ────────────────────────────────────
export const DEFAULT_COUPONS: Coupon[] = [
  { code: 'RAMADAN20',   type: 'pct',      value: 20, label: '-20%',               minOrder: 0,   maxUses: 100 },
  { code: 'BIENVENUE10', type: 'pct',      value: 10, label: '-10%',               minOrder: 0,   maxUses: 50  },
  { code: 'LUXVIP15',    type: 'pct',      value: 15, label: '-15% Signatures',    minOrder: 50,  maxUses: 30  },
  { code: 'LIVRAISON',   type: 'delivery', value: 15, label: 'Livraison gratuite', minOrder: 100, maxUses: 200 },
  { code: 'CADEAU50',    type: 'fixed',    value: 50, label: '-50 MAD',            minOrder: 100, maxUses: 5   },
];

// ─── STATIC MENU FALLBACK (when API + LS cache both empty) ────────────
export const STATIC_MENU: MenuCategory[] = [
  {
    id: 1, name: 'Cafés Classiques', icon: '☕', sortOrder: 0,
    products: [
      { id: 1, name: 'Espresso',          price: 7,  imageUrl: '', isSignature: false, categoryId: 1, description: '' },
      { id: 2, name: 'Cappuccino',         price: 12, imageUrl: '', isSignature: false, categoryId: 1, description: '' },
      { id: 3, name: 'Café Crème',         price: 10, imageUrl: '', isSignature: false, categoryId: 1, description: '' },
      { id: 4, name: 'Café au Lait',       price: 10, imageUrl: '', isSignature: false, categoryId: 1, description: '' },
    ],
  },
  {
    id: 2, name: 'Signature LUX', icon: '⭐', sortOrder: 1,
    products: [
      { id: 10, name: 'Zaazaa Lux',           price: 35, imageUrl: '', isSignature: true, categoryId: 2, description: 'Must Try!' },
      { id: 11, name: 'Lux Matcha Bloom',      price: 20, imageUrl: '', isSignature: true, categoryId: 2, description: 'Matcha premium crémeux' },
      { id: 12, name: "Queen's Rose Coffee",   price: 30, imageUrl: '', isSignature: true, categoryId: 2, description: 'Café, Milka, dattes, amandes' },
    ],
  },
  {
    id: 3, name: 'Infusions & Thés', icon: '🍵', sortOrder: 2,
    products: [
      { id: 20, name: 'Thé Marocain',          price: 9,  imageUrl: '', isSignature: false, categoryId: 3, description: '' },
      { id: 21, name: 'Thé Royal LUX',         price: 20, imageUrl: '', isSignature: true,  categoryId: 3, description: '+7 gâteaux marocains' },
    ],
  },
  {
    id: 4, name: 'Crêpes', icon: '🥞', sortOrder: 3,
    products: [
      { id: 30, name: 'Crêpe Nutella',         price: 20, imageUrl: '', isSignature: false, categoryId: 4, description: '' },
      { id: 31, name: 'Crêpe Royale',          price: 30, imageUrl: '', isSignature: true,  categoryId: 4, description: 'Nutella, banane, fraise' },
    ],
  },
  {
    id: 5, name: 'Petit-Déjeuner', icon: '🍳', sortOrder: 4,
    products: [
      { id: 40, name: 'Classic Breakfast',     price: 22, imageUrl: '', isSignature: false, categoryId: 5, description: 'Pain, oeuf, fromage, JO' },
      { id: 41, name: 'Morning Lux',           price: 35, imageUrl: '', isSignature: true,  categoryId: 5, description: '2 oeufs, fromage, salade fruits, JO' },
    ],
  },
];

// ─── IMAGE FALLBACKS ──────────────────────────────────────────────────
// Gradient-based SVG placeholders keyed by category id
export const CATEGORY_PLACEHOLDERS: Record<number, string> = {
  1: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231a0a00'/%3E%3Ctext x='200' y='150' font-size='80' text-anchor='middle' dominant-baseline='central'%3E☕%3C/text%3E%3C/svg%3E",
  2: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231a0a00'/%3E%3Ctext x='200' y='150' font-size='80' text-anchor='middle' dominant-baseline='central'%3E⭐%3C/text%3E%3C/svg%3E",
  3: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231a0a00'/%3E%3Ctext x='200' y='150' font-size='80' text-anchor='middle' dominant-baseline='central'%3E🍵%3C/text%3E%3C/svg%3E",
  4: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231a0a00'/%3E%3Ctext x='200' y='150' font-size='80' text-anchor='middle' dominant-baseline='central'%3E🥞%3C/text%3E%3C/svg%3E",
  5: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231a0a00'/%3E%3Ctext x='200' y='150' font-size='80' text-anchor='middle' dominant-baseline='central'%3E🍳%3C/text%3E%3C/svg%3E",
};

export const DEFAULT_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231a0a00'/%3E%3Ctext x='200' y='150' font-size='80' text-anchor='middle' dominant-baseline='central'%3E✦%3C/text%3E%3C/svg%3E";

export function getMenuImageSrc(item: { imageUrl?: string; categoryId?: number }): string {
  if (item.imageUrl && item.imageUrl.startsWith('http')) return item.imageUrl;
  return CATEGORY_PLACEHOLDERS[item.categoryId ?? 0] ?? DEFAULT_PLACEHOLDER;
}

// ─── SEED REVIEWS ─────────────────────────────────────────────────────
export const SEED_REVIEWS = [
  { id: 1, name: 'Fatima A.', stars: 5, text: 'Meilleur café de Taza! Les Signatures LUX sont incroyables. Je reviens chaque semaine.', verified: true, createdAt: '2025-12-01' },
  { id: 2, name: 'Youssef B.', stars: 5, text: 'Morning Lux parfait pour commencer la journée. Service rapide et cadre élégant.', verified: true, createdAt: '2025-12-15' },
  { id: 3, name: 'Sara M.',    stars: 4, text: 'Ambiance luxueuse, Zaazaa Lux à essayer absolument! Petit bémol: un peu d\'attente le weekend.', verified: false, createdAt: '2026-01-10' },
];
