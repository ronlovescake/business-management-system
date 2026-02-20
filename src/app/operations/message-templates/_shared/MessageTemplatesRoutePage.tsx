import { PageLayout } from '@/components/layout/PageLayout';
import { MessageTemplatesBoard } from '@/app/clothing/operations/message-templates/MessageTemplatesBoard';
import type { MessageTemplate } from '@/modules/clothing/operations/message-templates/types';

type MessageTemplatesRoutePageProps = {
  templates: MessageTemplate[];
  addTemplateCtaHref: string;
};

export function MessageTemplatesRoutePage(
  props: MessageTemplatesRoutePageProps
) {
  const { templates, addTemplateCtaHref } = props;

  return (
    <PageLayout size="xl">
      <MessageTemplatesBoard
        templates={templates}
        showHeader={false}
        showUsageHint={false}
        addTemplateCtaHref={addTemplateCtaHref}
      />
    </PageLayout>
  );
}
