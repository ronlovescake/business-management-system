import { PostTemplateRoutePage } from '@/app/operations/post-template/_shared/PostTemplateRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function PostTemplate() {
  return renderOperationsPage(
    '/clothing/operations/post-template',
    <PostTemplateRoutePage />
  );
}
