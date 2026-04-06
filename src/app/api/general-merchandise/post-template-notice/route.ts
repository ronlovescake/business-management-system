import { prisma } from '@/lib/db';
import { createPostTemplateNoticeService } from '@/modules/shared/messaging/api/postTemplateNoticeService';
import { createPostTemplateNoticeRoutes } from '@/modules/shared/messaging/api/postTemplateNoticeRouteFactory';

const service = createPostTemplateNoticeService(
  prisma.generalMerchandisePostTemplateNotice
);
const { GET, PUT } = createPostTemplateNoticeRoutes(service, 'GM');

export { GET, PUT };
