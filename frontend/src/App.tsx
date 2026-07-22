import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import {
  ArrowUpRight,
  BookText,
  Box,
  Camera,
  ClipboardList,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  MessageSquareText,
  ScanEye,
  X,
} from 'lucide-react'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `sidebar-link ${isActive ? 'active' : ''}`
}

export default function App() {
  const location = useLocation()
  const { projectId } = useParams<{ projectId?: string }>()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="shell">
      <div className="mobile-topbar">
        <button className="mobile-topbar-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="mobile-topbar-brand">
          <LayoutGrid size={18} className="brand-icon" />
          <span>PunchList AI</span>
        </div>
      </div>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <LayoutGrid size={22} className="brand-icon" />
            <div>
              <h1>PunchList AI</h1>
              <p>Photo → structured punch list</p>
            </div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={navLinkClass}>
            <FolderKanban size={18} />
            Projects
          </NavLink>
          <NavLink to="/quick" className={navLinkClass}>
            <Camera size={18} />
            Quick analyze
          </NavLink>
        </nav>

        {projectId && (
          <nav className="sidebar-nav sidebar-nav-project">
            <span className="sidebar-section-label">This project</span>
            <NavLink to={`/project/${projectId}`} end className={navLinkClass}>
              <ClipboardList size={18} />
              Punch list
            </NavLink>
            <NavLink to={`/project/${projectId}/dashboard`} className={navLinkClass}>
              <LayoutDashboard size={18} />
              Dashboard
            </NavLink>
            <NavLink to={`/project/${projectId}/inbox`} className={navLinkClass}>
              <Inbox size={18} />
              Inbox
            </NavLink>
            <NavLink to={`/project/${projectId}/ask`} className={navLinkClass}>
              <MessageSquareText size={18} />
              Ask
            </NavLink>
            <NavLink to={`/project/${projectId}/codes`} className={navLinkClass}>
              <BookText size={18} />
              Codes
            </NavLink>
            <NavLink to={`/project/${projectId}/twin`} className={navLinkClass}>
              <Box size={18} />
              Digital twin
            </NavLink>
            <NavLink to={`/project/${projectId}/vision`} className={navLinkClass}>
              <ScanEye size={18} />
              Vision
            </NavLink>
          </nav>
        )}

        <div className="sidebar-footer">
          <a
            className="gh-link"
            href="https://github.com/apani0409/punchlist-ai"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>

      <div className="main-area">
        <main className="page-main">
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
    </div>
  )
}
