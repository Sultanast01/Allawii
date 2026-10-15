import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { useStore } from './context/store';
import { wagmiConfig } from './config/wagmi';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import SetupPage from './pages/SetupPage';
import HomePage from './pages/HomePage';
import BudgetPage from './pages/BudgetPage';
import SpendPage from './pages/SpendPage';
import StatisticsPage from './pages/StatisticsPage';
import PatternsPage from './pages/PatternsPage';
import SavingsPage from './pages/SavingsPage';
import CoachPage from './pages/CoachPage';
import ProfilePage from './pages/ProfilePage';
import AddExpensePage from './pages/AddExpensePage';
import AffordCalculator from './pages/AffordCalculator';
import WhatIfPage from './pages/WhatIfPage';
import ReceiptScanPage from './pages/ReceiptScanPage';
import OffersPage from './pages/OffersPage';
import LiteracyPage from './pages/LiteracyPage';
import CalendarPage from './pages/CalendarPage';
import GroupsPage from './pages/GroupsPage';
import ScamPage from './pages/ScamPage';
import BMoniWalletPage from './pages/BMoniWalletPage';
import KycVerificationPage from './pages/KycVerificationPage';
import HelpPage from './pages/HelpPage';

const hideNavPaths = ['/login', '/signup', '/setup', '/add-expense', '/afford', '/what-if', '/receipt', '/profile', '/offers', '/literacy', '/calendar', '/groups', '/scam', '/bmoni', '/bmoni/kyc', '/statistics', '/patterns', '/help'];

function AppRoutes() {
  const { isAuthenticated, isDemoMode, textScale } = useStore();
  const location = useLocation();
  const hideNav = hideNavPaths.includes(location.pathname);

  useEffect(() => {
    document.documentElement.style.fontSize = textScale === 'large' ? '112.5%' : '';
  }, [textScale]);

  if (!isAuthenticated && !isDemoMode) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    );
  }

  return (
    <div className="lg:flex lg:min-h-dvh lg:bg-gradient-to-br from-surface-100 via-surface-50 to-primary-50/30">
      <Sidebar />
      <div className={`app-container lg:flex-1 lg:max-w-[1400px] lg:mx-0 lg:px-8 ${hideNav ? 'min-h-dvh' : 'pb-24 min-h-dvh lg:pb-8'}`}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/spend" element={<SpendPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/patterns" element={<PatternsPage />} />
          <Route path="/savings" element={<SavingsPage />} />
          <Route path="/coach" element={<CoachPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/add-expense" element={<AddExpensePage />} />
          <Route path="/afford" element={<AffordCalculator />} />
          <Route path="/what-if" element={<WhatIfPage />} />
          <Route path="/receipt" element={<ReceiptScanPage />} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/literacy" element={<LiteracyPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/scam" element={<ScamPage />} />
          <Route path="/bmoni" element={<BMoniWalletPage />} />
          <Route path="/bmoni/kyc" element={<KycVerificationPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
          </BrowserRouter>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}
