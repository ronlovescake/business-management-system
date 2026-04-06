import { prisma } from '@/lib/db';
import { createMessageTemplateService } from '@/modules/shared/messaging/api/messageTemplateService';
import { createMessageTemplateRoutes } from '@/modules/shared/messaging/api/messageTemplateRouteFactory';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

const service = createMessageTemplateService(
  prisma.generalMerchandiseMessageTemplate
);
const { GET, PUT, POST } = createMessageTemplateRoutes(service, 'GM');

export { GET, PUT, POST };
