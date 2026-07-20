import { NavLink, Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div className="shell">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">▦</span>
          <div>
            <h1>PunchList AI</h1>
            <p>Construction site photos → structured, tracked punch lists</p>
          </div>
        </div>
        <nav className="main-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Projects
          </NavLink>
          <NavLink to="/quick" className={({ isActive }) => (isActive ? 'active' : '')}>
            Quick analyze
          </NavLink>
        </nav>
        <a
          className="gh-link"
          href="https://github.com/apani0409/punchlist-ai"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        Built by{' '}
        <a href="https://github.com/apani0409" target="_blank" rel="noreferrer">
          Alessandro Pani
        </a>{' '}
        with React, FastAPI and Claude (developed with Claude Code). Inspired by Gaudi AI's
        public punch-list product description — independent demo, not affiliated. Not a
        substitute for professional inspection.
      </footer>
    </div>
  )
}
