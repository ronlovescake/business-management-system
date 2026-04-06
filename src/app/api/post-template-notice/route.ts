import { prisma } from '@/lib/db';
import { createPostTemplateNoticeService } from '@/modules/shared/messaging/api/postTemplateNoticeService';
import { createPostTemplateNoticeRoutes } from '@/modules/shared/messaging/api/postTemplateNoticeRouteFactory';

const service = createPostTemplateNoticeService(prisma.postTemplateNotice);
const { GET, PUT } = createPostTemplateNoticeRoutes(service);

export { GET, PUT };
