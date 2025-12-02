import type { Customer, Prisma } from '@prisma/client';

export type CustomerDTO = {
  id?: number;
  Date: string;
  'Customer Name': string;
  'Phone Number': string;
  Address: string;
  Facebook: string;
  'Email Address': string;
  'Business Name': string;
  'Tax Number': string;
  'Business Address': string;
  'Business Contact Number': string;
  'Customer Status': string;
};

export function mapToDTO(customer: Customer): CustomerDTO {
  return {
    id: customer.id,
    Date: customer.date ?? '',
    'Customer Name': customer.customerName ?? '',
    'Phone Number': customer.phoneNumber ?? '',
    Address: customer.address ?? '',
    Facebook: customer.facebook ?? '',
    'Email Address': customer.emailAddress ?? '',
    'Business Name': customer.businessName ?? '',
    'Tax Number': customer.taxNumber ?? '',
    'Business Address': customer.businessAddress ?? '',
    'Business Contact Number': customer.businessContactNumber ?? '',
    'Customer Status': customer.customerStatus ?? '',
  };
}

export function mapFromDTO(dto: CustomerDTO): Prisma.CustomerCreateInput {
  return {
    date: dto.Date ?? '',
    customerName: dto['Customer Name'] ?? '',
    phoneNumber: dto['Phone Number'] ?? '',
    address: dto.Address ?? '',
    facebook: dto.Facebook ?? '',
    emailAddress: dto['Email Address'] ?? '',
    businessName: dto['Business Name'] ?? '',
    taxNumber: dto['Tax Number'] ?? '',
    businessAddress: dto['Business Address'] ?? '',
    businessContactNumber: dto['Business Contact Number'] ?? '',
    customerStatus: dto['Customer Status'] ?? '',
  };
}
