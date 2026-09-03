import { useState } from 'react';
import {
  App as AntdApp,
  Button,
  Checkbox,
  ConfigProvider,
  Divider,
  Form,
  Input,
  Select,
  Typography,
} from 'antd';
import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import viz from '../assets/assetmx-visualization.jpg';
import { login } from '../api/auth';
import type { UserRole } from '../auth/session';
import './Login.css';

const { Link } = Typography;

type LoginFormValues = {
  role: UserRole;
  identifier: string;
  password: string;
  remember?: boolean;
};

function LoginInner({
  onForgot,
  onSignIn,
}: {
  onForgot: () => void;
  onSignIn?: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const user = await login({
        role: values.role,
        identifier: values.identifier,
        password: values.password,
        remember: values.remember,
      });
      message.success(`Signed in as ${user.email} (${user.role})`);
      onSignIn?.();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Sign in failed';
      message.error(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="amx-page">
      <main className="amx-card">
        {/* Left: Branding & Imagery */}
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

        {/* Right: Login Form */}
        <section className="amx-right">
          <div className="amx-form-card">
            <div className="amx-header">
              <h2 className="amx-welcome">Welcome back</h2>
              <p className="amx-subtext">Sign in to continue to AssetMX</p>
            </div>

            <Form<LoginFormValues>
              layout="vertical"
              requiredMark={false}
              initialValues={{ remember: true }}
              onFinish={onFinish}
            >
              <Form.Item
                label="Role"
                name="role"
                rules={[{ required: true, message: 'Please select your role' }]}
              >
                <Select
                  size="large"
                  placeholder="Select your role"
                  options={[
                    { value: 'employee', label: 'Employee' },
                    { value: 'host', label: 'Host' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'guard', label: 'Guard' },
                    { value: 'superadmin', label: 'SuperAdmin' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="Email or Employee ID"
                name="identifier"
                rules={[{ required: true, message: 'Please enter your email or employee ID' }]}
              >
                <Input size="large" placeholder="Enter your email or employee ID" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password size="large" placeholder="Enter your password" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 12 }}>
                <div className="amx-row-between">
                  <Form.Item name="remember" valuePropName="checked" noStyle>
                    <Checkbox>Remember me</Checkbox>
                  </Form.Item>
                  <Link
                    className="amx-link"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onForgot();
                    }}
                  >
                    Forgot password?
                  </Link>
                </div>
              </Form.Item>

              <Form.Item>
                <Button type="primary" size="large" htmlType="submit" block loading={loading}>
                  Sign in
                </Button>
              </Form.Item>
            </Form>

            <Divider plain className="amx-divider">
              OR
            </Divider>

            <Button size="large" block icon={<LockOutlined />} className="amx-sso">
              Continue with SSO
            </Button>

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

export default function LoginPage({
  onForgot,
  onSignIn,
}: {
  onForgot: () => void;
  onSignIn?: () => void;
}) {
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
        <LoginInner onForgot={onForgot} onSignIn={onSignIn} />
      </AntdApp>
    </ConfigProvider>
  );
}
