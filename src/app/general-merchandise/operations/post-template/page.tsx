import { PostTemplateRoutePage } from '@/app/operations/post-template/_shared/PostTemplateRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function PostTemplate() {
  return renderOperationsPage(
    '/general-merchandise/operations/post-template',
    <PostTemplateRoutePage apiBasePath="/api/general-merchandise" />
  );
}
