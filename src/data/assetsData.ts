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
    { value: 'Admin Office', label: 'Admin Office' },
    { value: 'Conference Room A', label: 'Conference Room A' },
    { value: 'Conference Room B', label: 'Conference Room B' },
    { value: 'Design Studio', label: 'Design Studio' },
    { value: 'Finance Office', label: 'Finance Office' },
    { value: 'HQ - Floor 4', label: 'HQ - Floor 4' },
    { value: 'IT Office', label: 'IT Office' },
    { value: 'Lab - Building A', label: 'Lab - Building A' },
    { value: 'Maintenance Workshop', label: 'Maintenance Workshop' },
    { value: 'Server Room', label: 'Server Room' },
  ],
  custodians: [
    { value: '', label: 'All Custodians' },
    { value: 'Admin', label: 'Admin' },
    { value: 'Finance', label: 'Finance' },
    { value: 'IT Department', label: 'IT Department' },
    { value: 'IT Operations', label: 'IT Operations' },
    { value: 'Maintenance', label: 'Maintenance' },
    { value: 'Operations', label: 'Operations' },
  ],
  categories: [
    { value: '', label: 'All Categories' },
    { value: 'Electrical', label: 'Electrical' },
    { value: 'Electronics', label: 'Electronics' },
    { value: 'Equipment', label: 'Equipment' },
    { value: 'Hardware', label: 'Hardware' },
    { value: 'Hardware / Compute', label: 'Hardware / Compute' },
    { value: 'IT Infrastructure', label: 'IT Infrastructure' },
  ],
};
