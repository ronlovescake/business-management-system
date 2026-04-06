import { prisma } from '@/lib/db';
import { createPostTemplateNoticeService } from '@/modules/shared/messaging/api/postTemplateNoticeService';

const service = createPostTemplateNoticeService(prisma.postTemplateNotice);

export const getPostTemplateNotice = service.getPostTemplateNotice;
export const upsertPostTemplateNotice = service.upsertPostTemplateNotice;
