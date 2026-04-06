import { prisma } from '@/lib/db';
import { createMessageTemplateService } from '@/modules/shared/messaging/api/messageTemplateService';

const service = createMessageTemplateService(prisma.messageTemplate);

export const getMessageTemplatesFromDb = service.getMessageTemplatesFromDb;
export const upsertMessageTemplate = service.upsertMessageTemplate;
export const createMessageTemplate = service.createMessageTemplate;
