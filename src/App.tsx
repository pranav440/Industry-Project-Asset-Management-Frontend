import { useEffect, useState } from 'react';
import LoginPage from './pages/Login';
import ForgotPasswordPage from './pages/ForgotPassword';
import DashboardPage from './pages/Dashboard';
import AssetsPage from './pages/Assets';
import AssetDetailsPage from './pages/AssetDetails';
import AddNewAssetPage from './pages/AddNewAsset';
import AssetTransferPage from './pages/AssetTransfer';
import AssetMaintenancePage from './pages/AssetMaintenance';
import ConsumablesPage from './pages/Consumables';
import ConsumableDetailsPage from './pages/ConsumableDetails';
import AddConsumablePage from './pages/AddConsumable';
import RequestsPage from './pages/Requests';
import RequestDetailsPage from './pages/RequestDetails';
import GatePassPage from './pages/GatePass';
import GatePassDetailsPage from './pages/GatePassDetails';
import GateVerificationPage from './pages/GateVerification';
import ReportsOverviewPage from './pages/ReportsOverview';
import AssetUtilizationPage from './pages/AssetUtilization';
import RequestsReportPage from './pages/RequestsReport';
import ReassignmentReportPage from './pages/ReassignmentReport';
import MaintenanceReportPage from './pages/MaintenanceReport';
import DisposalReportPage from './pages/DisposalReport';
import { clearSession, getToken, getTokenExpiry, replaceUser } from './auth/session';
import { fetchCurrentUser } from './api/auth';

type Route =
  | 'login'
  | 'forgot-password'
  | 'dashboard'
  | 'assets'
  | 'asset-details'
  | 'asset-transfer'
  | 'asset-maintenance'
  | 'add-asset'
  | 'consumables'
  | 'consumable-details'
  | 'add-consumable'
  | 'requests'
  | 'request-details'
  | 'gate-pass'
  | 'gate-pass-details'
  | 'gate-verification'
  | 'reports'
  | 'reports-utilization'
  | 'reports-requests'
  | 'reports-reassignment'
  | 'reports-maintenance'
  | 'reports-disposal';

function currentRoute(): { name: Route; assetId?: string; consumableId?: string; requestId?: string; passId?: string } {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/forgot-password')) {
      return { name: 'forgot-password' };
    }
    // Reports Routes
    if (path === '/reports/utilization' || path === '/reports/utilization/') {
      return { name: 'reports-utilization' };
    }
    if (path === '/reports/requests' || path === '/reports/requests/') {
      return { name: 'reports-requests' };
    }
    if (path === '/reports/reassignment' || path === '/reports/reassignment/') {
      return { name: 'reports-reassignment' };
    }
    if (path === '/reports/maintenance' || path === '/reports/maintenance/') {
      return { name: 'reports-maintenance' };
    }
    if (path === '/reports/disposal' || path === '/reports/disposal/') {
      return { name: 'reports-disposal' };
    }
    if (path === '/reports' || path === '/reports/') {
      return { name: 'reports' };
    }
    // Gate Pass Routes
    if (path.startsWith('/gate-pass/')) {
      const rest = path.slice('/gate-pass/'.length);
      if (rest.endsWith('/verification') || rest.endsWith('/verification/')) {
        const id = rest.replace(/\/verification\/?$/, '');
        return { name: 'gate-verification', passId: decodeURIComponent(id) };
      }
      return { name: 'gate-pass-details', passId: decodeURIComponent(rest) };
    }
    if (path === '/gate-pass' || path === '/gate-pass/') {
      return { name: 'gate-pass' };
    }
    // Requests Routes
    if (path.startsWith('/requests/')) {
      const rest = path.slice('/requests/'.length);
      return { name: 'request-details', requestId: decodeURIComponent(rest) };
    }
    if (path === '/requests' || path === '/requests/') {
      return { name: 'requests' };
    }
    // Consumables Routes
    if (path === '/consumables/new' || path === '/consumables/new/') {
      return { name: 'add-consumable' };
    }
    if (path.startsWith('/consumables/')) {
      const rest = path.slice('/consumables/'.length);
      return { name: 'consumable-details', consumableId: decodeURIComponent(rest) };
    }
    if (path === '/consumables' || path === '/consumables/') {
      return { name: 'consumables' };
    }
    // Assets Routes
    if (path === '/assets/new' || path === '/assets/new/') {
      return { name: 'add-asset' };
    }
    if (path.startsWith('/assets/')) {
      const rest = path.slice('/assets/'.length);
      if (rest.endsWith('/transfer') || rest.endsWith('/transfer/')) {
        const id = rest.replace(/\/transfer\/?$/, '');
        return { name: 'asset-transfer', assetId: decodeURIComponent(id) };
      }
      if (rest.endsWith('/maintenance') || rest.endsWith('/maintenance/')) {
        const id = rest.replace(/\/maintenance\/?$/, '');
        return { name: 'asset-maintenance', assetId: decodeURIComponent(id) };
      }
      return { name: 'asset-details', assetId: decodeURIComponent(rest) };
    }
    if (path.startsWith('/assets')) {
      return { name: 'assets' };
    }
    if (path.startsWith('/dashboard')) {
      return { name: 'dashboard' };
    }
    if (path === '/' || path.startsWith('/login')) {
      return { name: 'login' };
    }
  }
  return { name: 'dashboard' };
}

export default function App() {
  const [routeInfo, setRouteInfo] = useState<{ name: Route; assetId?: string; consumableId?: string; requestId?: string; passId?: string }>(currentRoute());
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const onPop = () => setRouteInfo(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const route = routeInfo.name;

  useEffect(() => {
    if (
      route !== 'dashboard' &&
      route !== 'assets' &&
      route !== 'asset-details' &&
      route !== 'asset-transfer' &&
      route !== 'asset-maintenance' &&
      route !== 'add-asset' &&
      route !== 'consumables' &&
      route !== 'consumable-details' &&
      route !== 'add-consumable' &&
      route !== 'requests' &&
      route !== 'request-details' &&
      route !== 'gate-pass' &&
      route !== 'gate-pass-details' &&
      route !== 'gate-verification' &&
      route !== 'reports' &&
      route !== 'reports-utilization' &&
      route !== 'reports-requests' &&
      route !== 'reports-reassignment' &&
      route !== 'reports-maintenance' &&
      route !== 'reports-disposal'
    ) {
      setSessionChecked(true);
      return;
    }

    const token = getToken();
    if (!token) {
      window.history.replaceState({}, '', '/login');
      setRouteInfo({ name: 'login' });
      setSessionChecked(true);
      return;
    }

    setSessionChecked(false);
    fetchCurrentUser(token)
      .then(replaceUser)
      .catch(() => {
        clearSession();
        window.history.replaceState({}, '', '/login');
        setRouteInfo({ name: 'login' });
      })
      .finally(() => setSessionChecked(true));
  }, [route]);

  useEffect(() => {
    const token = getToken();
    const expiry = getTokenExpiry(token);
    if (!token || expiry === null) {
      return;
    }

    const delay = Math.max(0, expiry * 1000 - Date.now());
    const timer = window.setTimeout(() => {
      clearSession();
      window.history.replaceState({}, '', '/login?session=expired');
      setRouteInfo({ name: 'login' });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [route, sessionChecked]);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setRouteInfo(currentRoute());
  };

  const signOut = () => {
    clearSession();
    navigate('/login');
  };

  const handleSubRouteNav = (subRoute: string) => {
    if (subRoute === 'dashboard') {
      navigate('/dashboard');
    } else if (subRoute === 'assets') {
      navigate('/assets');
    } else if (subRoute === 'consumables') {
      navigate('/consumables');
    } else if (subRoute === 'consumables/new') {
      navigate('/consumables/new');
    } else if (subRoute.startsWith('consumables/')) {
      navigate(`/${subRoute}`);
    } else if (subRoute === 'requests') {
      navigate('/requests');
    } else if (subRoute.startsWith('requests/')) {
      navigate(`/${subRoute}`);
    } else if (subRoute === 'gate-pass' || subRoute === 'gate pass') {
      navigate('/gate-pass');
    } else if (subRoute.startsWith('gate-pass/')) {
      navigate(`/${subRoute}`);
    } else if (subRoute === 'reports') {
      navigate('/reports');
    } else if (subRoute.startsWith('reports/')) {
      navigate(`/${subRoute}`);
    } else if (subRoute === 'signout' || subRoute === 'login') {
      signOut();
    } else if (subRoute.startsWith('assets/')) {
      navigate(`/${subRoute}`);
    } else {
      navigate(`/${subRoute}`);
    }
  };

  if (route === 'forgot-password') {
    return (
      <ForgotPasswordPage
        onBack={() => navigate('/login')}
        onNavigate={navigate}
      />
    );
  }

  if (!sessionChecked) {
    return null;
  }

  // Reports Routes
  if (route === 'reports-disposal' && getToken()) {
    return (
      <DisposalReportPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'reports-maintenance' && getToken()) {
    return (
      <MaintenanceReportPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'reports-reassignment' && getToken()) {
    return (
      <ReassignmentReportPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'reports-requests' && getToken()) {
    return (
      <RequestsReportPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'reports-utilization' && getToken()) {
    return (
      <AssetUtilizationPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'reports' && getToken()) {
    return (
      <ReportsOverviewPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Gate Verification Route
  if (route === 'gate-verification' && getToken()) {
    return (
      <GateVerificationPage
        passId={routeInfo.passId || 'GP-2026-0012'}
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Gate Pass Details Route
  if (route === 'gate-pass-details' && getToken()) {
    return (
      <GatePassDetailsPage
        passId={routeInfo.passId || 'GP-2026-0012'}
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Gate Pass List Route
  if (route === 'gate-pass' && getToken()) {
    return (
      <GatePassPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Request Details Route
  if (route === 'request-details' && getToken()) {
    return (
      <RequestDetailsPage
        requestId={routeInfo.requestId || 'REQ-2026-0041'}
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Requests List Route
  if (route === 'requests' && getToken()) {
    return (
      <RequestsPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Add Consumable Route
  if (route === 'add-consumable' && getToken()) {
    return (
      <AddConsumablePage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Consumable Details Route
  if (route === 'consumable-details' && getToken()) {
    return (
      <ConsumableDetailsPage
        consumableId={routeInfo.consumableId || 'CON-2026-0101'}
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Consumables List Route
  if (route === 'consumables' && getToken()) {
    return (
      <ConsumablesPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Add Asset Route
  if (route === 'add-asset' && getToken()) {
    return (
      <AddNewAssetPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Asset Transfer Route
  if (route === 'asset-transfer' && getToken()) {
    return (
      <AssetTransferPage
        assetId={routeInfo.assetId || 'AST-NC-2026-0012'}
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Asset Maintenance Route
  if (route === 'asset-maintenance' && getToken()) {
    return (
      <AssetMaintenancePage
        assetId={routeInfo.assetId || 'AST-NC-2026-0012'}
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Asset Details Route
  if (route === 'asset-details' && getToken()) {
    return (
      <AssetDetailsPage
        assetId={routeInfo.assetId || 'AST-NC-2026-0012'}
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Assets List Route
  if (route === 'assets' && getToken()) {
    return (
      <AssetsPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  // Dashboard Route
  if (route === 'dashboard' && getToken()) {
    return (
      <DashboardPage
        onNavigate={handleSubRouteNav}
        onSignOut={signOut}
      />
    );
  }

  return (
    <LoginPage
      onForgot={() => navigate('/forgot-password')}
      onSignIn={() => navigate('/dashboard')}
    />
  );
}
