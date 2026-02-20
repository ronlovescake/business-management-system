import { Container } from '@mantine/core';
import { DispatchComponent } from '@/modules/clothing/operations/dispatch';

export interface DispatchServerCustomerData {
  id: number;
  customerName: string;
  businessName: string;
  facebook: string;
  address: string;
  phoneNumber: string;
  shopeeUsernames: string[];
  additionalAddresses: string[];
}

type DispatchRoutePageProps = {
  serverCustomersData: DispatchServerCustomerData[];
  apiBasePath?: string;
};

export function DispatchRoutePage(props: DispatchRoutePageProps) {
  const { serverCustomersData, apiBasePath } = props;

  return (
    <Container size="xl" fluid p="md">
      <DispatchComponent
        serverCustomersData={serverCustomersData}
        apiBasePath={apiBasePath}
      />
    </Container>
  );
}
