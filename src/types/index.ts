export interface Business {
  id: string;
  name: string;
  type: 'clothing' | 'trucking';
}

export interface Workspace {
  id: string;
  name: string;
  businessId: string;
  type: 'operations' | 'employees';
}

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
}

export interface ShipmentData {
  id: number;
  'Shipment Code': string;
  'CV Number': string;
  'No. Of Sacks': number;
  'Total CBM': number;
  'Weight': number;
  'Fee': number;
  'Shipment Status': string;
  'Date Created': string;
  'Date Delivered': string;
  'Duration': string;
  'Notes': string;
}