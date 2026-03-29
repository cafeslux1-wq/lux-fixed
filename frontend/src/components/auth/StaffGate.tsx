// ─── CAFÉ LUX — Auth Components ──────────────────────────────────────
import React, { useState } from 'react';
import { useApp } from '../../lib/store';
import type { StaffUser } from '../../lib/types';

// ── re-exports ────────────────────────────────────────────────────────
export { PrivateRoute } from './PrivateRoute';

// ─────────────────────────────────────────────────────────────────────
// StaffGate — full-screen PIN authentication overlay
// ─────────────────────────────────────────────────────────────────────
interface StaffGateProps {
  requiredScope: 'staff' | 'admin';
}

export function StaffGate({ requiredScope }: StaffGateProps) {
  const { api, dispatch, toast, state } = useApp();
  const [step, setStep]         = useState<'select' | 'pin'>('select');
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [pin, setPin]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const employees: StaffUser[] = JSON.parse(localStorage.getItem('lux_employees') ?? '[]');

  const handleKey = async (key: string) => {
    if (loading) return;
    if (key === 'CANCEL') { setStep('select'); setPin(''); setError(''); return; }
    if (key === 'DEL')    { setPin(p => p.slice(0, -1)); setError(''); return; }

    const next = pin + key;
    setPin(next);
    if (next.length < 4) return;

    if (!selected) return;
    setLoading(true);
    setError('');

    try {
      const result = await api.authenticateStaffPin(selected.id, next);
      dispatch({
        type: 'SET_AUTH',
        payload: {
          user:  { ...selected, ...result },
          token: result.token,
          scope: result.role === 'admin' ? 'admin' : 'staff',
        },
      });
      toast(`✓ Bienvenue ${result.name ?? selected.name}!`, 'success');
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message === 'INVALID_PIN' ? 'PIN incorrect' : 'Erreur d\'authentification';
      setError(msg);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#080808',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      {/* Logo */}
      <div style={{ fontFamily: '"Cinzel",serif', fontSize: 28, color: '#C9A84C', letterSpacing: 8, marginBottom: 4 }}>✦ LUX</div>
      <div style={{ fontSize: 10, color: '#555', letterSpacing: 3, marginBottom: 40 }}>
        {requiredScope === 'admin' ? 'ACCÈS ADMINISTRATEUR' : 'ESPACE EMPLOYÉS'}
      </div>

      {step === 'select' ? (
        <div style={{ width: '100%', maxWidth: 340 }}>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
            Sélectionnez votre profil
          </div>
          {employees.length === 0 ? (
            <div style={{ color: '#444', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
              Aucun employé configuré.<br/>
              <span style={{ color: '#555', fontSize: 11, marginTop: 6, display: 'block' }}>
                Connectez l'API Railway pour charger la liste.
              </span>
            </div>
          ) : (
            employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => { setSelected(emp); setStep('pin'); setPin(''); setError(''); }}
                style={{
                  width: '100%', padding: '12px 16px', marginBottom: 8,
                  background: '#0F0F0F', border: '1px solid #1E1E1E',
                  borderRadius: 12, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 12, color: '#F2EFE9',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#2E2E2E')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1E1E1E')}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: '#C9A84C', fontWeight: 700,
                }}>
                  {emp.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{emp.name}</div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>{emp.role}</div>
                </div>
              </button>
            ))
          )}
          {/* API status */}
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: '#333' }}>
            {state.isOnline ? '⟡ Connecté à l\'API' : '⟡ Mode local (hors ligne)'}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 260 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {selected?.role === 'admin' ? '⚙️' : '👤'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{selected?.name}</div>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 24, textTransform: 'capitalize' }}>{selected?.role}</div>

          {/* PIN dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: '50%',
                background:   i < pin.length ? '#C9A84C' : 'transparent',
                border: `2px solid ${i < pin.length ? '#C9A84C' : '#2E2E2E'}`,
                transition: '.12s',
              }}/>
            ))}
          </div>

          {/* Error */}
          <div style={{ color: '#E05252', fontSize: 11, minHeight: 18, marginBottom: 8 }}>
            {error}
          </div>

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, maxWidth: 220, margin: '0 auto' }}>
            {['1','2','3','4','5','6','7','8','9','CANCEL','0','DEL'].map(k => (
              <button
                key={k}
                onClick={() => handleKey(k)}
                disabled={loading}
                style={{
                  padding: '15px 0', borderRadius: 10,
                  border: '1px solid #1E1E1E', background: '#0F0F0F',
                  color: k === 'CANCEL' ? '#E05252' : k === 'DEL' ? '#888' : '#F2EFE9',
                  fontSize: k.length > 1 ? 11 : 20, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1, transition: '.08s',
                }}
              >
                {k === 'DEL' ? '⌫' : k === 'CANCEL' ? '↩' : k}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, fontSize: 10, color: '#333' }}>
            {state.isOnline ? '⟡ Auth en ligne' : '⟡ Auth locale'}
          </div>
        </div>
      )}
    </div>
  );
}
