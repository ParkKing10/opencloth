import { Navbar } from './components/navbar/Navbar'
import { Hero } from './components/hero/Hero'
import { LogoBar } from './components/logo-bar/LogoBar'
import { Stats } from './components/stats/Stats'
import './App.css'

export function App() {
  return (
    <div className="page">
      <div className="page__ambient" aria-hidden="true" />
      <Navbar />
      <main>
        <Hero />
        <LogoBar />
        <Stats />
      </main>
    </div>
  )
}
