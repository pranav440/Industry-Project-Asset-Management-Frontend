import { useEffect, useState } from 'react';
import LoginPage from './pages/Login';
import ForgotPasswordPage from './pages/ForgotPassword';
import DashboardPage from './pages/Dashboard';
import AssetsPage from './pages/Assets';
import AssetDetailsPage from './pages/AssetDetails';
import AddNewAssetPage from './pages/AddNewAsset';
import AssetTransferPage from './pages/AssetTransfer';
import AssetMaintenancePage from './pages/AssetMaintenance';
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
  | 'add-asset';

function currentRoute(): { name: Route; assetId?: string } {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/forgot-password')) {
      return { name: 'forgot-password' };
    }
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
  const [routeInfo, setRouteInfo] = useState<{ name: Route; assetId?: string }>(currentRoute());
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
      route !== 'add-asset'
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

  if (route === 'add-asset' && getToken()) {
    return (
      <AddNewAssetPage
        onNavigate={(subRoute) => {
          if (subRoute === 'dashboard') {
            navigate('/dashboard');
          } else if (subRoute === 'assets') {
            navigate('/assets');
          } else if (subRoute === 'signout' || subRoute === 'login') {
            signOut();
          } else if (subRoute.startsWith('assets/')) {
            navigate(`/${subRoute}`);
          } else {
            navigate(`/assets#${subRoute}`);
          }
        }}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'asset-transfer' && getToken()) {
    return (
      <AssetTransferPage
        assetId={routeInfo.assetId || 'AST-NC-2026-0012'}
        onNavigate={(subRoute) => {
          if (subRoute === 'dashboard') {
            navigate('/dashboard');
          } else if (subRoute === 'assets') {
            navigate('/assets');
          } else if (subRoute === 'signout' || subRoute === 'login') {
            signOut();
          } else if (subRoute.startsWith('assets/')) {
            navigate(`/${subRoute}`);
          } else {
            navigate(`/assets#${subRoute}`);
          }
        }}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'asset-maintenance' && getToken()) {
    return (
      <AssetMaintenancePage
        assetId={routeInfo.assetId || 'AST-NC-2026-0012'}
        onNavigate={(subRoute) => {
          if (subRoute === 'dashboard') {
            navigate('/dashboard');
          } else if (subRoute === 'assets') {
            navigate('/assets');
          } else if (subRoute === 'signout' || subRoute === 'login') {
            signOut();
          } else if (subRoute.startsWith('assets/')) {
            navigate(`/${subRoute}`);
          } else {
            navigate(`/assets#${subRoute}`);
          }
        }}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'asset-details' && getToken()) {
    return (
      <AssetDetailsPage
        assetId={routeInfo.assetId || 'AST-NC-2026-0012'}
        onNavigate={(subRoute) => {
          if (subRoute === 'dashboard') {
            navigate('/dashboard');
          } else if (subRoute === 'assets') {
            navigate('/assets');
          } else if (subRoute === 'signout' || subRoute === 'login') {
            signOut();
          } else if (subRoute.startsWith('assets/')) {
            navigate(`/${subRoute}`);
          } else {
            navigate(`/assets#${subRoute}`);
          }
        }}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'assets' && getToken()) {
    return (
      <AssetsPage
        onNavigate={(subRoute) => {
          if (subRoute === 'dashboard') {
            navigate('/dashboard');
          } else if (subRoute === 'assets') {
            navigate('/assets');
          } else if (subRoute === 'signout' || subRoute === 'login') {
            signOut();
          } else if (subRoute.startsWith('assets/')) {
            navigate(`/${subRoute}`);
          } else {
            navigate(`/assets#${subRoute}`);
          }
        }}
        onSignOut={signOut}
      />
    );
  }

  if (route === 'dashboard' && getToken()) {
    return (
      <DashboardPage
        onNavigate={(subRoute) => {
          if (subRoute === 'dashboard') {
            navigate('/dashboard');
          } else if (subRoute === 'assets') {
            navigate('/assets');
          } else if (subRoute === 'signout' || subRoute === 'login') {
            signOut();
          } else if (subRoute.startsWith('assets/')) {
            navigate(`/${subRoute}`);
          } else {
            navigate(`/dashboard#${subRoute}`);
          }
        }}
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
