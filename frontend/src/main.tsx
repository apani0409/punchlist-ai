import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App'
import Home from './routes/Home'
import QuickAnalyze from './routes/QuickAnalyze'
import Project from './routes/Project'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="quick" element={<QuickAnalyze />} />
          <Route path="project/:projectId" element={<Project />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
