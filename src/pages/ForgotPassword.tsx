import { useState } from 'react';
import {
  App as AntdApp,
  Button,
  ConfigProvider,
  Form,
  Input,
  Typography,
} from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import viz from '../assets/assetmx-visualization.jpg';
import { confirmPasswordReset, requestPasswordReset } from '../api/auth';
import './Login.css';

const { Link } = Typography;

type ForgotFormValues = {
  identifier: string;
  password: string;
  confirmPassword: string;
};

function ForgotInner({ onBack, token }: { onBack: () => void; token?: string }) {
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);

  const onFinish = (values: ForgotFormValues) => {
    setLoading(true);
    const action = token ? confirmPasswordReset(token, values.password) : requestPasswordReset(values.identifier);
    action.then((result) => message.success(result.detail)).then(() => token && onBack())
      .catch((err) => message.error(err instanceof Error ? err.message : 'Request failed'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="amx-page">
      <main className="amx-card">
        {/* Left: Branding & Imagery (identical to approved Login design) */}
        <section className="amx-left">
          <div className="amx-left-top">
            <h1 className="amx-brand">AssetMX</h1>
            <p className="amx-tagline">Asset Management &amp; Movement Platform</p>
          </div>

          <div className="amx-left-center">
            <h2 className="amx-headline">
              Visibility. Control.
              <br />
              <span className="amx-accent">Accountability.</span>
            </h2>
            <p className="amx-desc">
              Real-time visibility and accountability across organizational assets,
              movement, and compliance.
            </p>
            <div className="amx-hero-img-wrap">
              <img className="amx-hero-img" alt="Asset Visualization" src={viz} />
            </div>
          </div>

          <div className="amx-left-bottom">
            <p className="amx-status-label">ASSETMX PLATFORM</p>
            <p className="amx-status-sub">Enterprise Asset Control</p>
            <div className="amx-status-ready">
              <span className="amx-status-dot" />
              <span>Platform ready</span>
            </div>
          </div>
        </section>

        {/* Right: Forgot Password Form */}
        <section className="amx-right">
          <div className="amx-form-card">
            <div className="amx-header">
              <h2 className="amx-welcome">{token ? 'Set a new password' : 'Forgot password?'}</h2>
              <p className="amx-subtext">{token ? 'Choose a new password for your AssetMX account.' : 'Enter your email or employee ID to continue.'}</p>
            </div>

            <Form<ForgotFormValues>
              layout="vertical"
              requiredMark={false}
              onFinish={onFinish}
            >
              <Form.Item
                label={token ? 'New password' : 'Email or Employee ID'}
                name={token ? 'password' : 'identifier'}
                rules={[{ required: true, min: token ? 12 : undefined, message: token ? 'Use at least 12 characters' : 'Please enter your email or employee ID' }]}
              >
                {token ? <Input.Password size="large" placeholder="Enter a new password" /> : <Input size="large" placeholder="Enter your email or employee ID" />}
              </Form.Item>

              {token && <Form.Item label="Confirm new password" name="confirmPassword" dependencies={['password']} rules={[{ required: true, message: 'Please confirm your new password' }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match')); } })]}><Input.Password size="large" placeholder="Confirm your new password" /></Form.Item>}

              <Form.Item>
                <Button type="primary" size="large" htmlType="submit" block loading={loading}>
                  Continue
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Link
                className="amx-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onBack();
                }}
              >
                Back to sign in
              </Link>
            </div>

            <div className="amx-footer">
              <div className="amx-footer-secure">
                <SafetyOutlined /> Secure access to AssetMX
              </div>
              <p className="amx-footer-access">
                Need access?{' '}
                <Link className="amx-link" href="#">
                  Contact your administrator
                </Link>
                .
              </p>
              <div className="amx-footer-meta">
                Secure enterprise access • Role-based permissions • Audit-ready
              </div>
              <p className="amx-footer-copy">© 2025 AssetMX. All rights reserved.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate?: (to: string) => void;
}) {
  const token = new URLSearchParams(window.location.search).get('token') ?? undefined;
  const handleBack = () => {
    onNavigate?.('/login');
    onBack();
  };
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563eb',
          colorPrimaryHover: '#1d4ed8',
          colorPrimaryActive: '#1d4ed8',
          colorLink: '#2563eb',
          colorLinkHover: '#1d4ed8',
          colorBorder: '#e4e7ec',
          colorBorderSecondary: '#e5e7eb',
          colorSplit: '#e5e7eb',
          colorText: '#141b2b',
          colorTextSecondary: '#434655',
          colorTextTertiary: '#667085',
          colorError: '#ba1a1a',
          borderRadius: 8,
          controlHeight: 48,
          fontSize: 16,
          lineWidth: 1,
          fontFamily:
            "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
      }}
    >
      <AntdApp>
        <ForgotInner onBack={handleBack} token={token} />
      </AntdApp>
    </ConfigProvider>
  );
}
