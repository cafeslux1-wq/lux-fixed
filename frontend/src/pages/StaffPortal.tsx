// StaffPortal — bascule vers la page PIN existante
// Cette page est le point d'entrée /portal/staff
// Elle réutilise le composant PinLogin existant

import PinLogin from '../components/pos/PinLogin'

type Navigate = (path: any) => void

export default function StaffPortal({ navigate }: { navigate: Navigate }) {
  return <PinLogin />
}
