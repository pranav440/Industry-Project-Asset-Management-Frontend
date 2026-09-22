export interface MetricCardData {
  id: string;
  title: string;
  value: string;
  icon: string;
  subtext?: string;
  trend?: {
    direction: 'down' | 'up';
    text: string;
  };
  statusType?: 'default' | 'error' | 'warning' | 'progress';
  progress?: number;
}

export interface RequestItem {
  id: string;
  itemName: string;
  status: 'Approved' | 'Pending' | 'Cancelled';
  approvalDate: string;
  fulfilmentDate: string;
  filterType: 'open' | 'closed';
}

export interface AssetInventoryData {
  location: string;
  custodian: string;
  category: string;
  totalAssets?: number;
  byStatus?: Record<string, number>;
}

export interface ExpiryAlertItem {
  id: number;
  title: string;
  expiryText: string;
  isUrgent: boolean;
}

export interface PurchaseOrderItem {
  poNumber: string;
  vendor: string;
  receivedDate: string;
}

export interface StockLevelItem {
  id: string;
  category: string;
  current: number;
  total: number;
  percentage: number;
  isCritical?: boolean;
  colorHex: string;
}

export interface DepartmentConsumptionItem {
  name: string;
  percentage: number;
  colorHex: string;
}

export const KPI_METRICS: MetricCardData[] = [
  {
    id: 'open-requests',
    title: 'Open Requests',
    value: '24',
    icon: 'pending_actions',
    trend: {
      direction: 'down',
      text: '12% vs last week',
    },
    statusType: 'default',
  },
  {
    id: 'pending-approvals',
    title: 'Pending Approvals',
    value: '08',
    icon: 'gavel',
    subtext: 'Requires action',
    statusType: 'error',
  },
  {
    id: 'low-stock-alerts',
    title: 'Low Stock Alerts',
    value: '05',
    icon: 'warning',
    subtext: 'Items critical',
    statusType: 'warning',
  },
  {
    id: 'monthly-spend',
    title: 'Monthly Spend',
    value: '₹2.45L',
    icon: 'payments',
    subtext: 'Invoices processed',
    statusType: 'default',
  },
  {
    id: 'budget-utilized',
    title: 'Budget Utilized',
    value: '68%',
    icon: 'pie_chart',
    progress: 68,
    statusType: 'progress',
  },
];

export const MY_REQUESTS: RequestItem[] = [
  {
    id: 'REQ-C-2026-0012',
    itemName: 'Dell Latitude 5430',
    status: 'Approved',
    approvalDate: '12 Oct 2023',
    fulfilmentDate: '15 Oct 2023',
    filterType: 'open',
  },
  {
    id: 'REQ-C-2026-0013',
    itemName: 'Ergonomic Chair Task',
    status: 'Pending',
    approvalDate: '--',
    fulfilmentDate: '--',
    filterType: 'open',
  },
  {
    id: 'REQ-C-2026-0014',
    itemName: 'A4 Printer Paper (Box)',
    status: 'Cancelled',
    approvalDate: '14 Oct 2023',
    fulfilmentDate: '--',
    filterType: 'closed',
  },
  {
    id: 'REQ-C-2026-0015',
    itemName: 'MacBook Pro 16"',
    status: 'Approved',
    approvalDate: '15 Oct 2023',
    fulfilmentDate: '20 Oct 2023',
    filterType: 'open',
  },
];

export const ASSET_INVENTORY: AssetInventoryData = {
  location: 'HQ - Floor 4',
  custodian: 'IT Dept',
  category: 'Hardware',
};

export const EXPIRY_ALERTS: ExpiryAlertItem[] = [
  {
    id: 1,
    title: 'Printer Ink (Cyan)',
    expiryText: 'Exp: Today',
    isUrgent: true,
  },
  {
    id: 2,
    title: 'First Aid Kits',
    expiryText: 'Exp: in 5 days',
    isUrgent: false,
  },
];

export const RECENT_POS: PurchaseOrderItem[] = [
  {
    poNumber: 'PO-9921-A',
    vendor: 'TechSupply Co.',
    receivedDate: 'Rcvd: 12 Oct',
  },
  {
    poNumber: 'PO-9920-B',
    vendor: 'OfficeMart',
    receivedDate: 'Rcvd: 10 Oct',
  },
  {
    poNumber: 'PO-9918-C',
    vendor: 'Global Equip',
    receivedDate: 'Rcvd: 05 Oct',
  },
];

export const STOCK_LEVELS: StockLevelItem[] = [
  {
    id: 'laptops',
    category: 'Laptops',
    current: 85,
    total: 100,
    percentage: 85,
    colorHex: '#acedff', // secondary-fixed
  },
  {
    id: 'chairs',
    category: 'Chairs',
    current: 45,
    total: 50,
    percentage: 90,
    colorHex: '#4cd7f6', // secondary-fixed-dim
  },
  {
    id: 'stationery',
    category: 'Stationery',
    current: 12,
    total: 200,
    percentage: 6,
    isCritical: true,
    colorHex: '#ba1a1a', // error
  },
  {
    id: 'lab-equipment',
    category: 'Lab Equipment',
    current: 22,
    total: 30,
    percentage: 73,
    colorHex: '#004e5c', // on-secondary-fixed-variant
  },
];

export const CONSUMPTION_DATA = {
  total: '₹1.2L',
  departments: [
    { name: 'IT', percentage: 40, colorHex: '#006172' },
    { name: 'Ops', percentage: 25, colorHex: '#4cd7f6' },
    { name: 'Admin', percentage: 20, colorHex: '#131b2e' },
    { name: 'HR', percentage: 10, colorHex: '#75859d' },
  ] as DepartmentConsumptionItem[],
};
