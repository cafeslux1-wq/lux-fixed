// ─── CAFÉ LUX — Constants & Fallback Data ────────────────────────────
import type { Coupon, MenuCategory, MenuItem } from './types';

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
  gpsRadius: 500,
  website:   'https://cafeslux.com',
  apiBase:   (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : undefined) ?? 'https://api.cafeslux.com',
} as const;

// ── Portal paths (single source of truth) ─────────────────────────────
export const PORTAL = {
  staff:     '/portal/staff',
  admin:     '/portal/admin',
  pos:       '/portal/pos',
  kds:       '/portal/kds',
  analytics: '/portal/analytics',
} as const;

export const DELIVERY = {
  fee:           15,
  freeThreshold: 200,
  etaMin:        30,
  etaMax:        45,
} as const;

export const TVA = 0.10;

// ── Loyalty levels ─────────────────────────────────────────────────────
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
    perks: ['Tout Silver', 'Boisson offerte / 200 pts', 'Réservation prioritaire'],
  },
  {
    id: 'diamond', name: 'Diamond', icon: '💎', color: '#5B8DEF',
    min: 600, max: Infinity,
    perks: ['Tout Gold', 'Livraison GRATUITE', 'Cadeau anniversaire', '-10% permanent'],
  },
] as const;

export type LoyaltyLevelId = typeof LOYALTY_LEVELS[number]['id'];

export function getLoyaltyLevel(pts: number) {
  return [...LOYALTY_LEVELS].reverse().find(l => pts >= l.min) ?? LOYALTY_LEVELS[0];
}

// ── Default coupons (LS fallback when API unreachable) ─────────────────
export const DEFAULT_COUPONS: Coupon[] = [
  { code: 'RAMADAN20',   type: 'pct',      value: 20, label: '-20%',               minOrder: 0,   maxUses: 100 },
  { code: 'BIENVENUE10', type: 'pct',      value: 10, label: '-10%',               minOrder: 0,   maxUses: 50  },
  { code: 'LUXVIP15',    type: 'pct',      value: 15, label: '-15% Signatures',    minOrder: 50,  maxUses: 30  },
  { code: 'LIVRAISON',   type: 'delivery', value: 15, label: 'Livraison gratuite', minOrder: 100, maxUses: 200 },
  { code: 'CADEAU50',    type: 'fixed',    value: 50, label: '-50 MAD',            minOrder: 100, maxUses: 5   },
];

// ── Premium SVG image fallbacks ────────────────────────────────────────
// Inline SVG encoded as data URIs — zero external dependency, no broken icons.
// Each uses a rich gradient + decorative pattern matching the category mood.

function makePlaceholderSVG(emoji: string, colorA: string, colorB: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colorA}"/>
        <stop offset="100%" stop-color="${colorB}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#g)"/>
    <circle cx="200" cy="130" r="64" fill="rgba(255,255,255,0.04)"/>
    <text x="200" y="140" font-size="72" text-anchor="middle" dominant-baseline="central" font-family="system-ui">${emoji}</text>
    <text x="200" y="220" font-size="14" text-anchor="middle" dominant-baseline="central" fill="rgba(255,255,255,0.35)" font-family="system-ui" letter-spacing="3">${label.toUpperCase()}</text>
    <rect x="160" y="238" width="80" height="1" fill="rgba(201,168,76,0.4)"/>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Category placeholders by category ID — extend as needed
export const CATEGORY_PLACEHOLDERS: Record<number, string> = {
  1: makePlaceholderSVG('☕', '#1A0800', '#0D0500', 'Cafés'),
  2: makePlaceholderSVG('⭐', '#1A0D00', '#120800', 'Signature'),
  3: makePlaceholderSVG('🍵', '#071A0A', '#04100A', 'Infusions'),
  4: makePlaceholderSVG('🥞', '#1A0F00', '#110900', 'Crêpes'),
  5: makePlaceholderSVG('🍳', '#0A0A1A', '#060614', 'Petit-Déj'),
  6: makePlaceholderSVG('🥤', '#001A12', '#00100D', 'Jus'),
  7: makePlaceholderSVG('🍰', '#1A0A12', '#100610', 'Pâtisseries'),
  8: makePlaceholderSVG('🍹', '#001218', '#000D14', 'Cocktails'),
  9: makePlaceholderSVG('🥗', '#071A07', '#051205', 'Salades'),
};

// Name-based keyword matching for when categoryId is missing
const KEYWORD_MAP: Array<[RegExp, number]> = [
  [/café|espresso|cappuccino|latte|macchiato|crème/i, 1],
  [/signature|lux|zaazaa|queen|bloom|royal/i,         2],
  [/thé|infusion|tisane|menthe|verveine/i,            3],
  [/crêpe|pancake/i,                                  4],
  [/déjeuner|breakfast|morning|oeuf|brioche/i,        5],
  [/jus|smoothie|milkshake/i,                         6],
  [/gâteau|tarte|cake|pâtisserie|mille/i,             7],
  [/cocktail|mojito|limonade/i,                       8],
  [/salade|bowl/i,                                    9],
];

function guessCategory(name: string, description: string): number {
  const text = `${name} ${description}`.toLowerCase();
  for (const [re, id] of KEYWORD_MAP) {
    if (re.test(text)) return id;
  }
  return 0;
}

export const DEFAULT_PLACEHOLDER = makePlaceholderSVG('✦', '#1A0D00', '#0A0600', 'Café LUX');

/**
 * Always returns a valid image src.
 * Priority: valid http URL → categoryId lookup → name/description keyword → default
 * Never returns '' or a broken reference.
 */
export function getMenuImageSrc(item: {
  imageUrl?: string;
  categoryId?: number;
  name?: string;
  description?: string;
}): string {
  // 1. Real HTTP image (validate it's not just a stub)
  if (item.imageUrl && item.imageUrl.startsWith('http') && item.imageUrl.length > 10) {
    return item.imageUrl;
  }
  // 2. Category ID lookup
  if (item.categoryId && CATEGORY_PLACEHOLDERS[item.categoryId]) {
    return CATEGORY_PLACEHOLDERS[item.categoryId];
  }
  // 3. Keyword guess from name+description
  const guessed = guessCategory(item.name ?? '', item.description ?? '');
  if (guessed && CATEGORY_PLACEHOLDERS[guessed]) {
    return CATEGORY_PLACEHOLDERS[guessed];
  }
  // 4. Default LUX placeholder
  return DEFAULT_PLACEHOLDER;
}

// ── Static menu fallback ───────────────────────────────────────────────
export const STATIC_MENU: MenuCategory[] = [
  {
    id: 1, name: 'Cafés Classiques', icon: '☕', sortOrder: 0,
    products: [
      { id: 1,  name: 'Espresso',       price: 7,  imageUrl: '', isSignature: false, categoryId: 1, active: true, description: 'Simple, Double ou Ristretto' },
      { id: 2,  name: 'Cappuccino',     price: 12, imageUrl: '', isSignature: false, categoryId: 1, active: true, description: 'Mousse de lait onctueuse' },
      { id: 3,  name: 'Café Crème',     price: 10, imageUrl: '', isSignature: false, categoryId: 1, active: true, description: '' },
      { id: 4,  name: 'Café au Lait',   price: 10, imageUrl: '', isSignature: false, categoryId: 1, active: true, description: '' },
      { id: 5,  name: 'Café Glacé',     price: 14, imageUrl: '', isSignature: false, categoryId: 1, active: true, description: 'Sur glace, servi frais' },
    ],
  },
  {
    id: 2, name: 'Signature LUX', icon: '⭐', sortOrder: 1,
    products: [
      { id: 10, name: 'Zaazaa Lux',          price: 35, imageUrl: '', isSignature: true, categoryId: 2, active: true, description: 'Must Try!' },
      { id: 11, name: 'Lux Matcha Bloom',     price: 20, imageUrl: '', isSignature: true, categoryId: 2, active: true, description: 'Matcha premium crémeux' },
      { id: 12, name: "Queen's Rose Coffee",  price: 30, imageUrl: '', isSignature: true, categoryId: 2, active: true, description: 'Café, Milka, dattes, amandes' },
    ],
  },
  {
    id: 3, name: 'Infusions & Thés', icon: '🍵', sortOrder: 2,
    products: [
      { id: 20, name: 'Thé Marocain',   price: 9,  imageUrl: '', isSignature: false, categoryId: 3, active: true, description: 'Menthe fraîche' },
      { id: 21, name: 'Thé Royal LUX', price: 20, imageUrl: '', isSignature: true,  categoryId: 3, active: true, description: '+7 gâteaux marocains' },
    ],
  },
  {
    id: 4, name: 'Crêpes', icon: '🥞', sortOrder: 3,
    products: [
      { id: 30, name: 'Crêpe Nutella', price: 20, imageUrl: '', isSignature: false, categoryId: 4, active: true, description: '' },
      { id: 31, name: 'Crêpe Royale', price: 30, imageUrl: '', isSignature: true,  categoryId: 4, active: true, description: 'Nutella, banane, fraise' },
    ],
  },
  {
    id: 5, name: 'Petit-Déjeuner', icon: '🍳', sortOrder: 4,
    products: [
      { id: 40, name: 'Classic Breakfast', price: 22, imageUrl: '', isSignature: false, categoryId: 5, active: true, description: 'Pain, oeuf, fromage, JO' },
      { id: 41, name: 'Morning Lux',       price: 35, imageUrl: '', isSignature: true,  categoryId: 5, active: true, description: '2 oeufs, fromage, salade fruits, JO' },
    ],
  },
];

// ── Seed reviews ───────────────────────────────────────────────────────
export const SEED_REVIEWS = [
  { id: 1, name: 'Fatima A.',  stars: 5, text: 'Meilleur café de Taza! Les Signatures LUX sont incroyables.', verified: true,  createdAt: '2025-12-01' },
  { id: 2, name: 'Youssef B.', stars: 5, text: 'Morning Lux parfait pour commencer la journée. Service rapide.', verified: true,  createdAt: '2025-12-15' },
  { id: 3, name: 'Sara M.',    stars: 4, text: 'Ambiance luxueuse, Zaazaa Lux à essayer absolument!', verified: false, createdAt: '2026-01-10' },
];
