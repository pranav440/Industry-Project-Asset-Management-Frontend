import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GateVerificationPage } from '../GateVerification';
import * as gatePassApi from '../../api/gatePassApi';
import * as session from '../../auth/session';

const { mockStart, mockStop, mockClear, getCamerasMock, scanCallbacks } = vi.hoisted(() => {
  return {
    mockStart: vi.fn(),
    mockStop: vi.fn().mockResolvedValue(undefined),
    mockClear: vi.fn().mockReturnValue(undefined),
    getCamerasMock: vi.fn().mockResolvedValue([
      { id: 'cam-rear', label: 'Back / Environment Camera' },
      { id: 'cam-front', label: 'Front / User Camera' },
    ]),
    scanCallbacks: {
      success: null as ((text: string, result?: any) => void) | null,
      error: null as ((err: string) => void) | null,
    },
  };
});

vi.mock('../../auth/session', () => ({
  getUser: vi.fn(),
  getToken: vi.fn().mockReturnValue('mock-token-xyz'),
}));

vi.mock('../../api/gatePassApi', () => ({
  getGatePass: vi.fn(),
  mapGatePassApiRecord: vi.fn((x) => x),
  validateGatePassQR: vi.fn(),
  verifyExitGatePass: vi.fn(),
  verifyEntryGatePass: vi.fn(),
  escalateGatePass: vi.fn(),
  GatePassApiError: class GatePassApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('html5-qrcode', () => {
  class MockHtml5Qrcode {
    static getCameras = getCamerasMock;
    start = mockStart;
    stop = mockStop;
    clear = mockClear;
    isScanning = true;
    getState = vi.fn().mockReturnValue(2);

    constructor(_elementId: string, _config?: any) {
      this.start = mockStart;
      this.stop = mockStop;
      this.clear = mockClear;
    }
  }

  return { Html5Qrcode: MockHtml5Qrcode };
});

const mockApprovedPass = {
  id: 'GP-2026-TEST',
  passType: 'Returnable',
  status: 'Approved',
  requesterName: 'Elena Vance',
  department: 'Operations',
  assetOrItem: 'Precision Laser Kit',
  quantity: 1,
  currentLocation: 'HQ Floor 2',
  destination: 'North Yard',
  movementDate: '2026-11-05',
  purpose: 'Field Testing',
  authorizationState: 'Approved',
  decisionStatus: 'Approved',
  gateActivity: {
    exitStatus: 'Pending',
    entryStatus: 'Pending',
    exitGate: 'North Gate - Commercial Bay 1',
    entryGate: 'Receiving Dock',
  },
  escalation: {},
  history: [],
};

describe('GateVerification Camera-Based QR Scanning (Prompt 16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanCallbacks.success = null;
    scanCallbacks.error = null;

    (session.getUser as any).mockReturnValue({
      id: 5,
      full_name: 'Officer Davis',
      role: 'guard',
    });

    (gatePassApi.getGatePass as any).mockResolvedValue(mockApprovedPass);

    mockStop.mockResolvedValue(undefined);
    mockClear.mockReturnValue(undefined);
    mockStart.mockImplementation((_config: any, _scanConfig: any, onSuccess: any, onError: any) => {
      scanCallbacks.success = onSuccess;
      scanCallbacks.error = onError;
      return Promise.resolve(null);
    });

    getCamerasMock.mockResolvedValue([
      { id: 'cam-rear', label: 'Back / Environment Camera' },
      { id: 'cam-front', label: 'Front / User Camera' },
    ]);

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Camera scanner starts when requested', async () => {
    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    const scanBtn = screen.getByRole('button', { name: /scan using camera/i });
    expect(scanBtn).toBeDefined();

    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
      expect(screen.getByText(/live camera viewfinder/i)).toBeDefined();
    });
  });

  it('2. Camera permission denial produces a useful error', async () => {
    mockStart.mockRejectedValue(new Error('NotAllowedError: Permission denied by user'));

    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    const scanBtn = screen.getByRole('button', { name: /scan using camera/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByText(/camera permission was denied/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
    });
  });

  it('3. Camera tracks stop when scanner closes', async () => {
    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    const scanBtn = screen.getByRole('button', { name: /scan using camera/i });
    fireEvent.click(scanBtn);

    await waitFor(() => expect(screen.getByText(/live camera viewfinder/i)).toBeDefined());

    // Close scanner
    const closeBtn = screen.getByRole('button', { name: /close camera scanner/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
    });
  });

  it('4. Camera tracks stop on component unmount', async () => {
    const { unmount } = render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    const scanBtn = screen.getByRole('button', { name: /scan using camera/i });
    fireEvent.click(scanBtn);

    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    unmount();

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
    });
  });

  it('5. A detected QR populates the existing input and sets source to camera', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-TEST',
      action_eligible: true,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Approved and eligible for exit',
      message: 'Validated',
    });

    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /scan using camera/i }));
    await waitFor(() => expect(scanCallbacks.success).toBeDefined());

    // Simulate camera optical detection
    await act(async () => {
      scanCallbacks.success!('assetmx:pass:GP-2026-TEST', {});
    });

    await waitFor(() => {
      const input = screen.getByPlaceholderText(/scan barcode, scan with camera/i) as HTMLInputElement;
      expect(input.value).toBe('assetmx:pass:GP-2026-TEST');
      expect(screen.getByText(/source: camera scan/i)).toBeDefined();
    });
  });

  it('6. A detected QR triggers backend validation API with exact decoded value', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-TEST',
      action_eligible: true,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Approved for exit',
      message: 'QR validated',
    });

    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /scan using camera/i }));
    await waitFor(() => expect(scanCallbacks.success).toBeDefined());

    await act(async () => {
      scanCallbacks.success!('assetmx:pass:GP-2026-TEST', {});
    });

    await waitFor(() => {
      expect(gatePassApi.validateGatePassQR).toHaveBeenCalledWith({
        qr_code: 'assetmx:pass:GP-2026-TEST',
        expected_pass_id: 'GP-2026-TEST',
        target_action: 'exit',
      });
      expect(screen.getByText(/qr validated & authenticated by backend/i)).toBeDefined();
    });
  });

  it('7. A QR belonging to a different pass does not enable verification', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: false,
      pass_id: 'GP-DIFFERENT-999',
      action_eligible: false,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Mismatched gate pass record',
      message: 'Mismatched QR code: Scanned code belongs to GP-DIFFERENT-999, expected GP-2026-TEST',
    });

    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /scan using camera/i }));
    await waitFor(() => expect(scanCallbacks.success).toBeDefined());

    await act(async () => {
      scanCallbacks.success!('assetmx:pass:GP-DIFFERENT-999', {});
    });

    await waitFor(() => {
      expect(screen.getByText(/qr validation failed/i)).toBeDefined();
      expect(gatePassApi.verifyExitGatePass).not.toHaveBeenCalled();
    });

    // Attempting exit verification should be blocked
    const confirmExitBtn = screen.getByRole('button', { name: /^verify exit/i });
    fireEvent.click(confirmExitBtn);
    expect(gatePassApi.verifyExitGatePass).not.toHaveBeenCalled();
  });

  it('8. A failed backend validation does not enable exit/entry actions', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: false,
      pass_id: null,
      action_eligible: false,
      resolved_format: null,
      eligibility_reason: null,
      message: 'Invalid QR code: No matching gate pass or asset found',
    });

    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /scan using camera/i }));
    await waitFor(() => expect(scanCallbacks.success).toBeDefined());

    await act(async () => {
      scanCallbacks.success!('corrupt_qr_data', {});
    });

    await waitFor(() => {
      expect(screen.getAllByText(/validation failed/i).length).toBeGreaterThan(0);
    });

    // Verify exit confirmation button fails to proceed
    fireEvent.click(screen.getByRole('button', { name: /^verify exit/i }));
    expect(gatePassApi.verifyExitGatePass).not.toHaveBeenCalled();
  });

  it('9. Repeated frame detections do not create duplicate validation requests', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-TEST',
      action_eligible: true,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Approved',
      message: 'Success',
    });

    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /scan using camera/i }));
    await waitFor(() => expect(scanCallbacks.success).toBeDefined());

    // Fire 5 rapid frame detection callbacks
    await act(async () => {
      scanCallbacks.success!('assetmx:pass:GP-2026-TEST', {});
      scanCallbacks.success!('assetmx:pass:GP-2026-TEST', {});
      scanCallbacks.success!('assetmx:pass:GP-2026-TEST', {});
      scanCallbacks.success!('assetmx:pass:GP-2026-TEST', {});
      scanCallbacks.success!('assetmx:pass:GP-2026-TEST', {});
    });

    await waitFor(() => {
      expect(gatePassApi.validateGatePassQR).toHaveBeenCalledTimes(1);
    });
  });

  it('10. Manual QR input continues to work and is distinguished from camera scan', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-TEST',
      action_eligible: true,
      resolved_format: 'pass_id',
      eligibility_reason: 'Approved',
      message: 'Valid',
    });

    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    const input = screen.getByPlaceholderText(/scan barcode, scan with camera/i);
    fireEvent.change(input, { target: { value: 'GP-2026-TEST' } });

    expect(screen.getByText(/source: manual text entry/i)).toBeDefined();

    const validateBtn = screen.getByRole('button', { name: /validate qr/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(gatePassApi.validateGatePassQR).toHaveBeenCalledWith({
        qr_code: 'GP-2026-TEST',
        expected_pass_id: 'GP-2026-TEST',
        target_action: 'exit',
      });
    });
  });

  it('11. USB/Bluetooth hardware scanner mode works cleanly', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-TEST',
      action_eligible: true,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Approved',
      message: 'Valid',
    });

    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    const hwBtn = screen.getByRole('button', { name: /hardware scanner/i });
    fireEvent.click(hwBtn);

    const input = screen.getByPlaceholderText(/scan barcode, scan with camera/i);
    fireEvent.change(input, { target: { value: 'assetmx:pass:GP-2026-TEST' } });

    expect(screen.getByText(/source: hardware scanner/i)).toBeDefined();

    const validateBtn = screen.getByRole('button', { name: /validate qr/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(gatePassApi.validateGatePassQR).toHaveBeenCalledWith({
        qr_code: 'assetmx:pass:GP-2026-TEST',
        expected_pass_id: 'GP-2026-TEST',
        target_action: 'exit',
      });
    });
  });

  it('12. Existing mandatory QR validation behavior remains intact', async () => {
    render(<GateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit (Qty: 1)')).toBeDefined());

    // Attempting exit verification without QR validation fails
    const exitBtn = screen.getByRole('button', { name: /^verify exit/i });
    fireEvent.click(exitBtn);

    expect(gatePassApi.verifyExitGatePass).not.toHaveBeenCalled();
    expect(screen.getByText(/mandatory qr validation required under srs qr-03/i)).toBeDefined();
  });
});
