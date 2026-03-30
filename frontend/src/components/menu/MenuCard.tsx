// ─── CAFÉ LUX — MenuCard with image fallback ─────────────────────────
import React, { useState } from 'react';
import type { MenuItem } from '../../lib/types';
import { getMenuImageSrc } from '../../lib/constants';
import { useApp } from '../../lib/store';

interface MenuCardProps {
  item: MenuItem;
  compact?: boolean;
}

export function MenuCard({ item, compact = false }: MenuCardProps) {
  const { addToCart, toast } = useApp();
  const [imgOk, setImgOk] = useState(true);

  const src  = imgOk && item.imageUrl?.startsWith('http') ? item.imageUrl : getMenuImageSrc(item);

  const handleAdd = () => {
    addToCart(item);
    toast(`✓ ${item.name} ajouté`, 'success');
  };

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0', borderBottom: '1px solid #111',
      }}>
        {/* Thumb */}
        <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={src}
            alt={item.name}
            onError={() => setImgOk(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.name}
            {item.isSignature && <span style={{ fontSize: 9, color: '#C9A84C', marginLeft: 5 }}>✦</span>}
          </div>
          {item.description && (
            <div style={{ fontSize: 10, color: '#666', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 15 }}>
            {item.price} MAD
          </span>
          <button onClick={handleAdd} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.3)',
            color: '#C9A84C', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>+</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#0F0F0F', border: '1px solid #1A1A1A',
      borderRadius: 14, overflow: 'hidden',
      transition: 'border-color .15s, transform .15s',
      cursor: 'pointer',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,.3)';
        (e.currentTarget as HTMLDivElement).style.transform   = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#1A1A1A';
        (e.currentTarget as HTMLDivElement).style.transform   = 'none';
      }}
      onClick={handleAdd}
    >
      {/* Image */}
      <div style={{ position: 'relative', paddingTop: '66%', overflow: 'hidden' }}>
        <img
          src={src}
          alt={item.name}
          onError={() => setImgOk(false)}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
          }}
        />
        {item.isSignature && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(201,168,76,.9)', color: '#000',
            padding: '2px 8px', borderRadius: 10,
            fontSize: 9, fontWeight: 700, letterSpacing: 1,
          }}>
            ✦ SIGNATURE
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{item.name}</div>
        {item.description && (
          <div style={{ fontSize: 11, color: '#666', marginBottom: 10, lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: '"Cormorant Garamond",serif', color: '#C9A84C', fontSize: 17 }}>
            {item.price} MAD
          </span>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#C9A84C', fontSize: 20,
          }}>+</div>
        </div>
      </div>
    </div>
  );
}
