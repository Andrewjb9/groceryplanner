import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

export default function TabLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-none">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
