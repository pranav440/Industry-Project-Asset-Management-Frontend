// =====================================================================
// AssetMX Asset Inventory Data Types & Demonstration Records
// Business/Display-Independent Types (Presentation handled by AssetStatusBadge)
// =====================================================================

export type AssetStatus = 'Active' | 'In Maintenance' | 'Disposed' | 'In Transit';

export interface AssetItem {
  id: string;
  name: string;
  category: string;
  location: string;
  custodian: string;
  status: AssetStatus;
}

export const ASSET_FILTER_OPTIONS = {
  locations: [
    { value: '', label: 'All Locations' },
    { value: 'HQ - Floor 4', label: 'HQ - Floor 4' },
    { value: 'HQ - Floor 2', label: 'HQ - Floor 2' },
    { value: 'Lab - Building A', label: 'Lab - Building A' },
    { value: 'Warehouse', label: 'Warehouse' },
    { value: 'Server Room', label: 'Server Room' },
  ],
  custodians: [
    { value: '', label: 'All Custodians' },
    { value: 'IT Department', label: 'IT Department' },
    { value: 'Operations', label: 'Operations' },
    { value: 'Lab Department', label: 'Lab Department' },
    { value: 'Admin', label: 'Admin' },
  ],
  categories: [
    { value: '', label: 'All Categories' },
    { value: 'Hardware', label: 'Hardware' },
    { value: 'Furniture', label: 'Furniture' },
    { value: 'Lab Equipment', label: 'Lab Equipment' },
    { value: 'IT Equipment', label: 'IT Equipment' },
  ],
};
