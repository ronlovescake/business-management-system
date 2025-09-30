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

// Database model interface
export interface ShipmentDB {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  shipmentCode: string;
  cvNumber: string | null;
  noOfSacks: number;
  totalCBM: number;
  weight: number;
  fee: number;
  shipmentStatus: string;
  dateCreated: string | null;
  dateDelivered: string | null;
  duration: string | null;
  notes: string | null;
}