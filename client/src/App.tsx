import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './context/store';
import BottomNav from './components/BottomNav';
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';
import BudgetPage from './pages/BudgetPage';
import SpendPage from './pages/SpendPage';
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

const hideNavPaths = ['/welcome', '/add-expense', '/afford', '/what-if', '/receipt', '/profile', '/offers', '/literacy', '/calendar', '/groups', '/scam', '/bmoni'];

function AppRoutes() {
  const { isAuthenticated, isDemoMode, textScale } = useStore();
  const location = useLocation();
  const hideNav = hideNavPaths.includes(location.pathname);

  useEffect(() => {
    document.documentElement.style.fontSize = textScale === 'large' ? '112.5%' : '';
  }, [textScale]);

  if (!isAuthenticated && !isDemoMode) {
    return <WelcomePage />;
  }

  return (
    <div className="app-container">
      <div className={hideNav ? 'min-h-screen' : 'pb-24 min-h-screen'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/spend" element={<SpendPage />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}
