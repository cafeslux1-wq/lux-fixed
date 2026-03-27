import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import MenuPage from './pages/MenuPage'
import StaffPortal from './pages/StaffPortal'
import POSPage from './pages/POSPage'
import AdminPage from './pages/AdminPage'
import CustomerApp from './pages/CustomerApp'

type Route = '/' | '/menu' | '/portal/staff' | '/portal/admin' | '/portal/pos' | '/app/customer'

export default function App() {
  const [route, setRoute] = useState<Route>('/')

  useEffect(() => {
    const path = window.location.pathname as Route
    const validRoutes: Route[] = ['/', '/menu', '/portal/staff', '/portal/admin', '/portal/pos', '/app/customer']
    if (validRoutes.includes(path)) setRoute(path)
    else setRoute('/')
  }, [])

  const navigate = (path: Route) => {
    window.history.pushState({}, '', path)
    setRoute(path)
  }

  switch (route) {
    case '/menu':        return <MenuPage navigate={navigate} />
    case '/portal/staff': return <StaffPortal navigate={navigate} />
    case '/portal/admin': return <AdminPage navigate={navigate} />
    case '/portal/pos':   return <POSPage navigate={navigate} />
    case '/app/customer': return <CustomerApp navigate={navigate} />
    default:              return <HomePage navigate={navigate} />
  }
}
