import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GuardGateVerificationPage } from '../GuardGateVerification';
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
  currentLocation: 'HQ Logistics Bay',
  destination: 'North Yard Testing Facility',
  movementDate: '2026-11-09',
  purpose: 'Field Testing',
  authorizationState: 'Approved',
  decisionStatus: 'Approved',
  decisionBy: 'Sarah Jenkins',
  gateActivity: {
    exitStatus: 'Pending',
    entryStatus: 'Pending',
    exitGate: 'Gate-01A',
    entryGate: 'Destination Receiving Dock',
  },
  escalation: {},
  history: [],
};

const mockActiveReturnablePass = {
  ...mockApprovedPass,
  status: 'Active',
  gateActivity: {
    exitStatus: 'Verified',
    entryStatus: 'Pending',
    exitGate: 'Gate-01A',
    entryGate: 'Destination Receiving Dock',
  },
};

describe('GuardGateVerificationPage Recovery & Backend Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scanCallbacks.success = null;
    scanCallbacks.error = null;

    (session.getUser as any).mockReturnValue({
      id: 5,
      full_name: 'Marcus Vance',
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

  it('1. Loads real Gate Pass data from backend and displays metadata', async () => {
    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);

    await waitFor(() => {
      expect(gatePassApi.getGatePass).toHaveBeenCalledWith('GP-2026-TEST');
      expect(screen.getAllByText('GP-2026-TEST').length).toBeGreaterThan(0);
      expect(screen.getByText('Elena Vance')).toBeDefined();
      expect(screen.getByText('Precision Laser Kit')).toBeDefined();
    });
  });

  it('2. Shows ready state when rendered without a passId and supports dynamic search', async () => {
    render(<GuardGateVerificationPage />);

    expect(screen.getByText(/Ready for Checkpoint Inspection/i)).toBeDefined();

    const input = screen.getByPlaceholderText(/Enter Gate Pass ID/i);
    fireEvent.change(input, { target: { value: 'GP-2026-TEST' } });

    const searchBtn = screen.getByRole('button', { name: /search pass/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(gatePassApi.getGatePass).toHaveBeenCalledWith('GP-2026-TEST');
      expect(screen.getByText('Precision Laser Kit')).toBeDefined();
    });
  });

  it('3. Camera scanner modal opens, initializes html5-qrcode and stops on close', async () => {
    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    const openScanBtn = screen.getByRole('button', { name: /qr \/ barcode scan/i });
    fireEvent.click(openScanBtn);

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
      expect(screen.getByText(/Checkpoint Camera & QR Scanner/i)).toBeDefined();
    });

    const closeBtn = screen.getByRole('button', { name: /close camera scanner/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
    });
  });

  it('4. Camera scanner cleans up on component unmount', async () => {
    const { unmount } = render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    const openScanBtn = screen.getByRole('button', { name: /qr \/ barcode scan/i });
    fireEvent.click(openScanBtn);

    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    unmount();

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
    });
  });

  it('5. Camera permission denial produces actionable error feedback and retry button', async () => {
    mockStart.mockRejectedValue(new Error('NotAllowedError: Permission denied by user'));

    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    const openScanBtn = screen.getByRole('button', { name: /qr \/ barcode scan/i });
    fireEvent.click(openScanBtn);

    await waitFor(() => {
      expect(screen.getByText(/camera permission was denied/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /retry camera/i })).toBeDefined();
    });
  });

  it('6. Valid QR detection triggers backend validation API, auto-checks Item 1 ONLY, and preserves Item 3 pending physical inspection', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-TEST',
      action_eligible: true,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Approved for exit',
      message: 'Validated successfully',
    });

    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    const openScanBtn = screen.getByRole('button', { name: /qr \/ barcode scan/i });
    fireEvent.click(openScanBtn);

    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    await act(async () => {
      scanCallbacks.success?.('assetmx:pass:GP-2026-TEST');
    });

    await waitFor(() => {
      expect(gatePassApi.validateGatePassQR).toHaveBeenCalledWith({
        qr_code: 'assetmx:pass:GP-2026-TEST',
        expected_pass_id: 'GP-2026-TEST',
        target_action: 'exit',
      });
      expect(screen.getByText(/Camera Scan/i)).toBeDefined();
    });

    // Check that Item 3 (Physical Serial Numbers Matched) is NOT auto-checked by QR alone
    const item3Checkbox = document.getElementById('checkAssetSerial') as HTMLInputElement;
    expect(item3Checkbox).toBeDefined();
    expect(item3Checkbox.checked).toBe(false);
    expect(screen.getByText(/Pending Check/i)).toBeDefined();

    // Explicit physical verification action (Verify Asset) marks Item 3 complete and verified
    const verifyAssetBtn = screen.getByRole('button', { name: /Verify Asset/i });
    fireEvent.click(verifyAssetBtn);

    expect(item3Checkbox.checked).toBe(true);
    expect(screen.getAllByText(/Verified/i).length).toBeGreaterThan(0);
  });

  it('7. Mismatched QR code is rejected with helpful error feedback', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-OTHER',
      action_eligible: true,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Different pass',
      message: 'Different pass code',
    });

    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    const openScanBtn = screen.getByRole('button', { name: /qr \/ barcode scan/i });
    fireEvent.click(openScanBtn);

    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    await act(async () => {
      scanCallbacks.success?.('assetmx:pass:GP-2026-OTHER');
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Mismatched QR code/i).length).toBeGreaterThan(0);
    });
  });

  it('8. Exit verification calls verifyExitGatePass with validated QR code', async () => {
    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-TEST',
      action_eligible: true,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Approved for exit',
      message: 'Validated',
    });

    (gatePassApi.verifyExitGatePass as any).mockResolvedValue({
      ...mockApprovedPass,
      status: 'Active',
      exit_status: 'Verified',
      exit_gate: 'Gate-01A',
    });

    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    // Validate QR manually
    const openScanBtn = screen.getByRole('button', { name: /qr \/ barcode scan/i });
    fireEvent.click(openScanBtn);
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    await act(async () => {
      scanCallbacks.success?.('assetmx:pass:GP-2026-TEST');
    });

    // Check remaining un-checked checklist items
    await waitFor(() => expect(screen.getByText(/Camera Scan/i)).toBeDefined());
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => {
      if (!cb.hasAttribute('disabled') && !(cb as HTMLInputElement).checked) {
        fireEvent.click(cb);
      }
    });

    // Gate clearance button should be enabled
    const releaseBtn = screen.getByRole('button', { name: /Confirm Exit Clearance/i });
    expect(releaseBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(releaseBtn);

    await waitFor(() => {
      expect(gatePassApi.verifyExitGatePass).toHaveBeenCalledWith('GP-2026-TEST', {
        exit_gate: 'Gate-01A',
        exit_notes: undefined,
        qr_code: 'assetmx:pass:GP-2026-TEST',
      });
      expect(screen.getAllByText(/GATE CLEARED/i).length).toBeGreaterThan(0);
    });
  });

  it('9. Entry verification calls verifyEntryGatePass for active returnable pass', async () => {
    (gatePassApi.getGatePass as any).mockResolvedValue(mockActiveReturnablePass);

    (gatePassApi.validateGatePassQR as any).mockResolvedValue({
      valid: true,
      pass_id: 'GP-2026-TEST',
      action_eligible: true,
      resolved_format: 'pass_urn',
      eligibility_reason: 'Active return intake',
      message: 'Validated',
    });

    (gatePassApi.verifyEntryGatePass as any).mockResolvedValue({
      ...mockActiveReturnablePass,
      status: 'Completed',
      entry_status: 'Verified',
      entry_gate: 'Gate-01A',
    });

    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    // Validate QR
    const openScanBtn = screen.getByRole('button', { name: /qr \/ barcode scan/i });
    fireEvent.click(openScanBtn);
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    await act(async () => {
      scanCallbacks.success?.('assetmx:pass:GP-2026-TEST');
    });

    // Check remaining un-checked checklist items
    await waitFor(() => expect(screen.getByText(/Camera Scan/i)).toBeDefined());
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => {
      if (!cb.hasAttribute('disabled') && !(cb as HTMLInputElement).checked) {
        fireEvent.click(cb);
      }
    });

    const entryBtn = screen.getByRole('button', { name: /Confirm Entry Clearance/i });
    expect(entryBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(entryBtn);

    await waitFor(() => {
      expect(gatePassApi.verifyEntryGatePass).toHaveBeenCalledWith('GP-2026-TEST', {
        entry_gate: 'Gate-01A',
        entry_notes: undefined,
        qr_code: 'assetmx:pass:GP-2026-TEST',
      });
    });
  });

  it('10. Flagging a discrepancy calls escalateGatePass with reason', async () => {
    (gatePassApi.escalateGatePass as any).mockResolvedValue({
      ...mockApprovedPass,
      status: 'Escalated',
    });

    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    const flagBtn = screen.getByRole('button', { name: /Flag Discrepancy/i });
    fireEvent.click(flagBtn);

    await waitFor(() => expect(screen.getByText(/Flag Checkpoint Discrepancy/i)).toBeDefined());

    const reasonInput = screen.getByPlaceholderText(/Enter discrepancy reasons/i);
    fireEvent.change(reasonInput, { target: { value: 'Container tamper seal severed at checkpoint' } });

    const confirmBtn = screen.getByRole('button', { name: /Confirm Discrepancy/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(gatePassApi.escalateGatePass).toHaveBeenCalledWith('GP-2026-TEST', {
        reason: 'Container tamper seal severed at checkpoint',
        action_required: 'Checkpoint physical inspection exception review required.',
      });
    });
  });

  it('11. Release clearance is blocked if QR has not been validated under SRS QR-03', async () => {
    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    // Without QR validation, release button is disabled
    const releaseBtn = screen.getByRole('button', { name: /Confirm Exit Clearance/i });
    expect(releaseBtn.hasAttribute('disabled')).toBe(true);
    expect(gatePassApi.verifyExitGatePass).not.toHaveBeenCalled();
  });

  it('12. Bulk physical check performs manual confirmation without claiming automated/cryptographic comparison', async () => {
    render(<GuardGateVerificationPage passId="GP-2026-TEST" />);
    await waitFor(() => expect(screen.getByText('Precision Laser Kit')).toBeDefined());

    const bulkBtn = screen.getByRole('button', { name: /Confirm Physical Check \(Manual\)/i });
    expect(bulkBtn).toBeDefined();

    fireEvent.click(bulkBtn);

    const item3Checkbox = document.getElementById('checkAssetSerial') as HTMLInputElement;
    expect(item3Checkbox.checked).toBe(true);
    expect(screen.getAllByText(/Verified/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/All manifest items and serial tags manually confirmed by guard inspection/i)).toBeDefined();
  });
});
