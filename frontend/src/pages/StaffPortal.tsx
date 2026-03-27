// StaffPortal — /portal/staff
// يعيد توجيه المستخدم إلى صفحة PIN الرئيسية

import { useEffect, useState } from 'react'

type Navigate = (path: any) => void

const GOLD = '#C9A84C'

export default function StaffPortal({ navigate }: { navigate: Navigate }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // انتقل إلى الصفحة الرئيسية حيث يوجد PinLogin
    setTimeout(() => {
      navigate('/')
    }, 800)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0D0D',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        background: `linear-gradient(135deg, ${GOLD}, #8B6E2F)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        fontWeight: 700,
        color: '#000',
        marginBottom: 20,
        fontFamily: "'Playfair Display', serif",
      }}>L</div>

      <div style={{ color: GOLD, fontSize: 14, letterSpacing: '.1em' }}>
        STAFF PORTAL
      </div>
      <div style={{ color: '#444', fontSize: 12, marginTop: 8 }}>
        Redirection en cours...
      </div>
    </div>
  )
}

