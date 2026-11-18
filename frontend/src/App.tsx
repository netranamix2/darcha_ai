import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AuroraBackground } from './components/AuroraBackground'
import { PublicLayout } from './components/PublicLayout'
import { RouteBoundary, RouteLoading } from './components/RouteFeedback'
import { RouteMetadata } from './components/RouteMetadata'
import { readStaffRole, staffLanding } from './lib/staff-landing'

const PublicChatPage = lazy(() => import('./pages/PublicChatPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const PanelLayout = lazy(() => import('./components/PanelLayout'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const TicketsPage = lazy(() => import('./pages/TicketsPage'))
const InboxPage = lazy(() => import('./pages/InboxPage'))
const UiPage = lazy(() => import('./pages/UiPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function PanelStart() {
  return <Navigate replace to={staffLanding(readStaffRole())} />
}

export default function App() {
  return (
    <>
      <AuroraBackground />
      <RouteMetadata />
      <RouteBoundary>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<PublicChatPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="ui" element={<UiPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route
            path="panel"
            element={
              <Suspense fallback={<RouteLoading />}>
                <PanelLayout />
              </Suspense>
            }
          >
            <Route index element={<PanelStart />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>
        </Routes>
      </RouteBoundary>
    </>
  )
}
