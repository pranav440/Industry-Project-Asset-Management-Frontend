import { useEffect, useState } from 'react';
import LoginPage from './pages/Login';
import ForgotPasswordPage from './pages/ForgotPassword';
import DashboardPage from './pages/Dashboard';
import AssetsPage from './pages/Assets';

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

  useEffect(() => {
    const onPop = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setRoute(currentRoute());
  };

  if (route === 'forgot-password') {
    return (
      <ForgotPasswordPage
        onBack={() => navigate('/login')}
        onNavigate={navigate}
      />
    );
  }

  if (route === 'assets') {
    return (
      <AssetsPage
        onNavigate={(subRoute) => {
          if (subRoute === 'dashboard') {
            navigate('/dashboard');
          } else if (subRoute === 'assets') {
            navigate('/assets');
          } else if (subRoute === 'signout' || subRoute === 'login') {
            navigate('/login');
          } else {
            navigate(`/assets#${subRoute}`);
          }
        }}
        onSignOut={() => navigate('/login')}
      />
    );
  }

  if (route === 'dashboard') {
    return (
      <DashboardPage
        onNavigate={(subRoute) => {
          if (subRoute === 'dashboard') {
            navigate('/dashboard');
          } else if (subRoute === 'assets') {
            navigate('/assets');
          } else if (subRoute === 'signout' || subRoute === 'login') {
            navigate('/login');
          } else {
            navigate(`/dashboard#${subRoute}`);
          }
        }}
        onSignOut={() => navigate('/login')}
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
