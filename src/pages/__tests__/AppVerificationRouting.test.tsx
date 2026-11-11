import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import * as session from '../../auth/session';
import * as authApi from '../../api/auth';

vi.mock('../../auth/session', () => ({
  getToken: vi.fn(),
  getUser: vi.fn(),
  getTokenExpiry: vi.fn().mockReturnValue(null),
  replaceUser: vi.fn(),
  clearSession: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('../../api/auth', () => ({
  fetchCurrentUser: vi.fn(),
}));

vi.mock('../GateVerification', () => ({
  GateVerificationPage: (props: any) => (
    <div data-testid="admin-gate-verification" data-pass-id={props.passId}>
      Admin Gate Verification Console ({props.passId})
    </div>
  ),
}));

vi.mock('../GuardGateVerification', () => ({
  GuardGateVerificationPage: (props: any) => (
    <div data-testid="guard-gate-verification" data-pass-id={props.passId}>
      Guard Gate Verification Console ({props.passId})
    </div>
  ),
}));

describe('App Gate Verification Routing: Role & Pass ID Separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (session.getToken as any).mockReturnValue('valid-token-123');
    (session.getTokenExpiry as any).mockReturnValue(null);
  });

  it('1. Admin user on /gate-verification renders Admin GateVerificationPage', async () => {
    window.history.pushState({}, '', '/gate-verification');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Admin User',
      role: 'admin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Admin User',
      role: 'admin',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-gate-verification')).toBeDefined();
      expect(screen.queryByTestId('guard-gate-verification')).toBeNull();
    });
  });

  it('2. Guard user on /gate-verification renders GuardGateVerificationPage', async () => {
    window.history.pushState({}, '', '/gate-verification');
    (session.getUser as any).mockReturnValue({
      id: 2,
      full_name: 'Guard Officer',
      role: 'guard',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 2,
      full_name: 'Guard Officer',
      role: 'guard',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('guard-gate-verification')).toBeDefined();
      expect(screen.queryByTestId('admin-gate-verification')).toBeNull();
    });
  });

  it('3. Admin user on direct URL /gate-pass/GP-2026-0099/verification renders Admin GateVerificationPage with dynamic passId', async () => {
    window.history.pushState({}, '', '/gate-pass/GP-2026-0099/verification');
    (session.getUser as any).mockReturnValue({
      id: 1,
      full_name: 'Admin User',
      role: 'admin',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 1,
      full_name: 'Admin User',
      role: 'admin',
    });

    render(<App />);

    await waitFor(() => {
      const el = screen.getByTestId('admin-gate-verification');
      expect(el).toBeDefined();
      expect(el.getAttribute('data-pass-id')).toBe('GP-2026-0099');
      expect(screen.queryByTestId('guard-gate-verification')).toBeNull();
    });
  });

  it('4. Guard user on direct URL /gate-pass/GP-2026-0099/verification renders GuardGateVerificationPage with dynamic passId', async () => {
    window.history.pushState({}, '', '/gate-pass/GP-2026-0099/verification');
    (session.getUser as any).mockReturnValue({
      id: 2,
      full_name: 'Guard Officer',
      role: 'guard',
    });
    (authApi.fetchCurrentUser as any).mockResolvedValue({
      id: 2,
      full_name: 'Guard Officer',
      role: 'guard',
    });

    render(<App />);

    await waitFor(() => {
      const el = screen.getByTestId('guard-gate-verification');
      expect(el).toBeDefined();
      expect(el.getAttribute('data-pass-id')).toBe('GP-2026-0099');
      expect(screen.queryByTestId('admin-gate-verification')).toBeNull();
    });
  });
});
