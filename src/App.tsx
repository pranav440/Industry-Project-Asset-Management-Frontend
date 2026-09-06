import { useEffect, useState } from 'react';
import LoginPage from './pages/Login';
import ForgotPasswordPage from './pages/ForgotPassword';
import DashboardPage from './pages/Dashboard';
import AssetsPage from './pages/Assets';
import AssetDetailsPage from './pages/AssetDetails';
import { clearSession, getToken, getTokenExpiry, replaceUser } from './auth/session';
import { fetchCurrentUser } from './api/auth';

type Route = 'login' | 'forgot-password' | 'dashboard' | 'assets' | 'asset-details';

function currentRoute(): { name: Route; assetId?: string } {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/forgot-password')) {
      return { name: 'forgot-password' };
    }
    if (path.startsWith('/assets/')) {
      const id = path.slice('/assets/'.length);
      return { name: 'asset-details', assetId: decodeURIComponent(id) };
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
    if (route !== 'dashboard' && route !== 'assets' && route !== 'asset-details') {
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
