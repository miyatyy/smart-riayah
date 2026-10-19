import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LandingPage from './components/landing/LandingPage';
import LoginPage from './components/auth/LoginPage';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import SuperAdminDashboard from './components/roles/SuperAdminDashboard';
import AdminRiayahDashboard from './components/roles/AdminRiayahDashboard';
import ParentPortal from './components/roles/ParentPortal';
import MusyrifDashboard from './components/roles/MusyrifDashboard';
import SecurityCommandCenter from './components/roles/SecurityCommandCenter';
import PoskestrenClinic from './components/roles/PoskestrenClinic';
import ExecutiveAnalytics from './components/roles/ExecutiveAnalytics';
import WhatsAppDrawer from './components/common/WhatsAppDrawer';
import RfidEcosystemModal from './components/modules/RfidEcosystemModal';
import RfidCardManager from './components/modules/RfidCardManager';
import SerialMonitorModal from './components/common/SerialMonitorModal';
import SmartRiayahAiAgentModal from './components/common/SmartRiayahAiAgentModal';
import { Bot } from 'lucide-react';

function MainContent() {
  const { role } = useApp();

  return (
    <main className="flex-1 p-2 sm:p-4 md:p-6 overflow-y-auto">
      {role === 'superadmin' && <SuperAdminDashboard />}
      {role === 'admin_riayah' && <AdminRiayahDashboard />}
      {role === 'parent' && <ParentPortal />}
      {role === 'musyrif' && <MusyrifDashboard />}
      {role === 'security' && <SecurityCommandCenter />}
      {role === 'poskestren' && <PoskestrenClinic />}
      {role === 'kyai' && <ExecutiveAnalytics />}
    </main>
  );
}

function AppShell() {
  const { isSidebarCollapsed, isRfidManagerModalOpen, setIsRfidManagerModalOpen, setIsAiAgentOpen } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. Left Professional Sidebar (7 Roles) */}
      <Sidebar />

      {/* 2. Main Work Area (Adjusts with Sidebar Collapse State) */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
        }`}
      >
        <Navbar />
        <MainContent />
      </div>

      {/* Floating AI Agent Trigger FAB */}
      <button
        onClick={() => setIsAiAgentOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all duration-200 border border-indigo-400/50 group"
        title="Buka Smart Riayah AI Agent (Evaluasi Diagram & DeepSeek AI)"
      >
        <span className="p-1 rounded-full bg-white/20 group-hover:rotate-12 transition">
          <Bot className="w-4 h-4 text-cyan-200" />
        </span>
        <span className="font-sans">AI Agent</span>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
        </span>
      </button>

      {/* 3. Floating Drawers & Modals */}
      <WhatsAppDrawer />
      <RfidEcosystemModal />
      <SerialMonitorModal />
      <SmartRiayahAiAgentModal />
    </div>
  );
}

function AppRouter() {
  const { currentView, isAuthenticated } = useApp();

  // If user is not authenticated or explicitly viewing landing page
  if (currentView === 'landing' || (!isAuthenticated && currentView !== 'login')) {
    return <LandingPage />;
  }

  // If user wants to log in or needs authentication
  if (currentView === 'login' || !isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated Dashboard Shell
  return <AppShell />;
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
