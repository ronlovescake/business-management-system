import { PostTemplateRoutePage } from '@/app/operations/post-template/_shared/PostTemplateRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function PostTemplate() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/post-template',
    <PostTemplateRoutePage apiBasePath="/api/general-merchandise" />
  );
}
