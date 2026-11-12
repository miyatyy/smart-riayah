import React, { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';

const LandingPage = lazy(() => import('./components/landing/LandingPage'));
const LoginPage = lazy(() => import('./components/auth/LoginPage'));
const Sidebar = lazy(() => import('./components/layout/Sidebar'));
const Navbar = lazy(() => import('./components/layout/Navbar'));
const SuperAdminDashboard = lazy(() => import('./components/roles/SuperAdminDashboard'));
const AdminRiayahDashboard = lazy(() => import('./components/roles/AdminRiayahDashboard'));
const ParentPortal = lazy(() => import('./components/roles/ParentPortal'));
const MusyrifDashboard = lazy(() => import('./components/roles/MusyrifDashboard'));
const SecurityCommandCenter = lazy(() => import('./components/roles/SecurityCommandCenter'));
const PoskestrenClinic = lazy(() => import('./components/roles/PoskestrenClinic'));
const ExecutiveAnalytics = lazy(() => import('./components/roles/ExecutiveAnalytics'));
const OsisDashboard = lazy(() => import('./components/roles/OsisDashboard'));
const WhatsAppDrawer = lazy(() => import('./components/common/WhatsAppDrawer'));
const RfidEcosystemModal = lazy(() => import('./components/modules/RfidEcosystemModal'));
const SerialMonitorModal = lazy(() => import('./components/common/SerialMonitorModal'));
const SmartRiayahAiAgentModal = lazy(() => import('./components/common/SmartRiayahAiAgentModal'));
const MobileBottomNav = lazy(() => import('./components/layout/MobileBottomNav'));
const FlutterIntegrationModal = lazy(() => import('./components/modules/FlutterIntegrationModal'));
const GatePassVerificationPage = lazy(() => import('./components/modules/GatePassVerificationPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-slate-400">Memuat halaman Smart Riayah...</p>
      </div>
    </div>
  );
}

function MainContent() {
  const { role } = useApp();

  return (
    <main className="flex-1 p-2 sm:p-4 md:p-6 overflow-y-auto pb-12 lg:pb-8">
      <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Memuat modul dashboard...</div>}>
        {role === 'superadmin' && <SuperAdminDashboard />}
        {role === 'admin_riayah' && <AdminRiayahDashboard />}
        {role === 'parent' && <ParentPortal />}
        {role === 'musyrif' && <MusyrifDashboard />}
        {role === 'security' && <SecurityCommandCenter />}
        {role === 'poskestren' && <PoskestrenClinic />}
        {role === 'kyai' && <ExecutiveAnalytics />}
        {role === 'osis' && <OsisDashboard />}
      </Suspense>
    </main>
  );
}

function AppShell() {
  const { isSidebarCollapsed } = useApp();
  const [isFlutterModalOpen, setIsFlutterModalOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. Left Professional Sidebar (8 Roles) */}
      <Sidebar onOpenFlutterModal={() => setIsFlutterModalOpen(true)} />

      {/* 2. Main Work Area (Adjusts with Sidebar Collapse State) */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
        }`}
      >
        <Navbar onOpenFlutterModal={() => setIsFlutterModalOpen(true)} />
        <MainContent />
      </div>

      {/* 3. Floating Drawers & Modals */}
      <WhatsAppDrawer />
      <RfidEcosystemModal />
      <SerialMonitorModal />
      <SmartRiayahAiAgentModal />
      {isFlutterModalOpen && (
        <FlutterIntegrationModal
          isOpen={isFlutterModalOpen}
          onClose={() => setIsFlutterModalOpen(false)}
        />
      )}

      {/* 4. Auto-Responsive Mobile Bottom Navigation Bar (< 1024px) */}
      <MobileBottomNav onOpenFlutterModal={() => setIsFlutterModalOpen(true)} />
    </div>
  );
}

function AppRouter() {
  const { currentView, isAuthenticated, activeGatePassToken, clearGatePassToken } = useApp();

  // Jika URL membuka token Gate Pass (?gatepass=SR-... atau /gate-pass/SR-...), tampilkan halaman verifikasi mandiri
  if (activeGatePassToken) {
    return (
      <Suspense fallback={<PageLoader />}>
        <GatePassVerificationPage token={activeGatePassToken} onBackToDashboard={clearGatePassToken} />
      </Suspense>
    );
  }

  // If user is not authenticated or explicitly viewing landing page
  if (currentView === 'landing' || (!isAuthenticated && currentView !== 'login')) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  // If user wants to log in or needs authentication
  if (currentView === 'login' || !isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    );
  }

  // Authenticated Dashboard Shell
  return (
    <Suspense fallback={<PageLoader />}>
      <AppShell />
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
