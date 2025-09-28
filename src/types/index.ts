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