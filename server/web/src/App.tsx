import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import DashboardLayout from './pages/dashboard/Layout'
import Overview from './pages/dashboard/Overview'
import Subscription from './pages/dashboard/Subscription'
import Account from './pages/dashboard/Account'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Overview />} />
        <Route path="subscription" element={<Subscription />} />
        <Route path="account" element={<Account />} />
      </Route>
    </Routes>
  )
}
