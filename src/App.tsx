import { useEffect, useState } from 'react';
import LoginPage from './pages/Login';
import ForgotPasswordPage from './pages/ForgotPassword';
import DashboardPage from './pages/Dashboard';
import AssetsPage from './pages/Assets';
import { clearSession, getToken, getTokenExpiry, replaceUser } from './auth/session';
import { fetchCurrentUser } from './api/auth';

type Route = 'login' | 'forgot-password' | 'dashboard' | 'assets';

function currentRoute(): Route {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.startsWith('/forgot-password')) {
      return 'forgot-password';
    }
    if (path.startsWith('/assets')) {
      return 'assets';
    }
    if (path.startsWith('/dashboard')) {
      return 'dashboard';
    }
    if (path === '/' || path.startsWith('/login')) {
      return 'login';
    }
  }
  return 'dashboard';
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute());
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const onPop = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (route !== 'dashboard' && route !== 'assets') {
      setSessionChecked(true);
      return;
    }

    const token = getToken();
    if (!token) {
      window.history.replaceState({}, '', '/login');
      setRoute('login');
      setSessionChecked(true);
      return;
    }

    setSessionChecked(false);
    fetchCurrentUser(token)
      .then(replaceUser)
      .catch(() => {
        clearSession();
        window.history.replaceState({}, '', '/login');
        setRoute('login');
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
      setRoute('login');
    }, delay);

    return () => window.clearTimeout(timer);
  }, [route, sessionChecked]);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setRoute(currentRoute());
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
