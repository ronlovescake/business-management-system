import { ApiResponse } from '@/core/api';

export const GET = () =>
  ApiResponse.error(
    'Change Log API moved to /api/clothing/operations/settings/change-log',
    410
  );
