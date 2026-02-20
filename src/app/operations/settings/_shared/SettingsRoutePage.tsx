import { SettingsPage } from '@/modules/clothing/operations/settings/components/SettingsPage';
import { SettingsErrorBoundary } from '@/app/clothing/operations/settings/components/SettingsErrorBoundary';

type SettingsRoutePageProps = {
  apiBasePath?: string;
};

export function SettingsRoutePage(props: SettingsRoutePageProps) {
  const { apiBasePath } = props;

  return (
    <SettingsErrorBoundary>
      <SettingsPage apiBasePath={apiBasePath} />
    </SettingsErrorBoundary>
  );
}
