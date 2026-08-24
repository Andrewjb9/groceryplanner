import { Route, Routes } from 'react-router-dom'
import TabLayout from './components/TabLayout'
import Week from './routes/Week'
import Recipes from './routes/Recipes'
import History from './routes/History'
import Items from './routes/Items'
import Shop from './routes/Shop'

export default function App() {
  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<Week />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/history" element={<History />} />
        <Route path="/items" element={<Items />} />
      </Route>
      <Route path="/shop" element={<Shop />} />
    </Routes>
  )
}
