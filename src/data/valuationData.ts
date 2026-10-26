// =====================================================================
// AssetMX Asset Valuation & Depreciation Shared Types
// Backend API is the source of truth for valuation records
// =====================================================================

export interface AssetValuationRecord {
  id: string;
  assetId: string;
  effectiveDate: string; // YYYY-MM-DD
  previousValue: number | string | null;
  newRecordedValue: number;
  formulaUsed: string;
  notes: string;
  reference?: string;
  updatedBy: string;
  recordedAt: string; // YYYY-MM-DD HH:mm:ss or ISO
}
