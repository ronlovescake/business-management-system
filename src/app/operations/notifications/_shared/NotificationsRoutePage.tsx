import { NotificationsClientPage } from '@/app/clothing/operations/notifications/NotificationsClientPage';

type NotificationsRoutePageProps = {
  apiBasePath?: string;
};

export function NotificationsRoutePage(props: NotificationsRoutePageProps) {
  const { apiBasePath } = props;
  return <NotificationsClientPage apiBasePath={apiBasePath} />;
}
