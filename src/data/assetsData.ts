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

export const ASSETS_MOCK_DATA: AssetItem[] = [
  {
    id: 'AST-NC-2026-0012',
    name: 'Dell Latitude 5430',
    category: 'Hardware',
    location: 'HQ - Floor 4',
    custodian: 'IT Department',
    status: 'Active',
  },
  {
    id: 'AST-NC-2026-0013',
    name: 'Ergonomic Chair',
    category: 'Furniture',
    location: 'HQ - Floor 2',
    custodian: 'Operations',
    status: 'Active',
  },
  {
    id: 'AST-NC-2026-0014',
    name: 'MacBook Pro 16',
    category: 'Hardware',
    location: 'HQ - Floor 4',
    custodian: 'IT Department',
    status: 'In Maintenance',
  },
  {
    id: 'AST-NC-2026-0015',
    name: 'Lab Analyzer',
    category: 'Lab Equipment',
    location: 'Lab - Building A',
    custodian: 'Lab Department',
    status: 'Active',
  },
  {
    id: 'AST-NC-2026-0016',
    name: 'Office Desk (L-Shape)',
    category: 'Furniture',
    location: 'Warehouse',
    custodian: 'Admin',
    status: 'Disposed',
  },
  {
    id: 'AST-NC-2026-0017',
    name: 'Cisco Router 9300',
    category: 'IT Equipment',
    location: 'Server Room',
    custodian: 'IT Department',
    status: 'In Transit',
  },
];

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
