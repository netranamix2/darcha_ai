import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AuroraBackground } from './components/AuroraBackground'
import { PublicLayout } from './components/PublicLayout'
import { useT } from './i18n/useT'

const PublicChatPage = lazy(() => import('./pages/PublicChatPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const PanelLayout = lazy(() => import('./components/PanelLayout'))
const PanelPage = lazy(() => import('./pages/PanelPage'))
const TicketsPage = lazy(() => import('./pages/TicketsPage'))
const InboxPage = lazy(() => import('./pages/InboxPage'))
const UiPage = lazy(() => import('./pages/UiPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  const t = useT()

  return (
    <>
      <AuroraBackground />
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
            <Suspense fallback={<p className="route-loading" role="status">{t('common.loading')}</p>}>
              <PanelLayout />
            </Suspense>
          }
        >
          <Route index element={<Navigate replace to="/panel/inbox" />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="analytics" element={<PanelPage sectionId="analytics" />} />
        </Route>
      </Routes>
    </>
  )
}
