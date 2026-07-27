import { useState, useEffect } from 'react';
import LoginForm from './components/auth/LoginForm';
import Layout from './components/common/Layout';
import Dashboard from './components/dashboard/Dashboard';
import InventoryManager from './components/inventory/InventoryManager';
import SalesManager from './components/sales/SalesManager';
import ReportsManager from './components/reports/ReportsManager';
import JasaCatManager from './components/services/JasaCatManager';
import UserManager from './components/users/UserManager';
import { getCurrentUser, validateSession } from './utils/auth';
import type { User } from './types';
import { initializeDefaultData } from './utils/storage';
import { loadColorCache } from './utils/categoryColors';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Validasi sesi ke server saat load. Identitas & role diambil dari /me
  // (sumber kebenaran di server), sehingga localStorage tidak bisa dipercaya untuk hak akses.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const validated = await validateSession();
      if (!mounted) return;
      setUser(validated);
      setChecking(false);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (user) {
      void initializeDefaultData();
      void loadColorCache();
    }
  }, [user]);

  // Reload warna setiap kali data kategori berubah
  useEffect(() => {
    const refresh = () => void loadColorCache();
    window.addEventListener('appDataChanged', refresh);
    return () => window.removeEventListener('appDataChanged', refresh);
  }, []);

  useEffect(() => {
    const eventHandler = (e: Event) => {
      try {
        const tab = (e as CustomEvent).detail;
        if (typeof tab === 'string') setActiveTab(tab);
      } catch {
        // ignore
      }
    };

    const onHashChange = () => {
      const h = window.location.hash.replace('#', '');
      if (h) setActiveTab(h);
    };

    window.addEventListener('changeTab', eventHandler as EventListener);
    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    return () => {
      window.removeEventListener('changeTab', eventHandler as EventListener);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const handleLogin = (success: boolean) => {
    if (success) {
      setUser(getCurrentUser());
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Memeriksa sesi...
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'inventory':
        return <InventoryManager />;
      case 'sales':
        return <SalesManager />;
      case 'reports-product':
        return <ReportsManager type="produk" />;
      case 'reports-service':
        return <ReportsManager type="jasa" />;
      case 'jasaCat':
        return <JasaCatManager />;
      case 'users':
        // Hanya admin yang bisa akses halaman pengguna
        return user.role === 'admin' ? <UserManager /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default App;
