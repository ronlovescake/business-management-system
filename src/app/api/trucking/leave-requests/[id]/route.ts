/**
 * Trucking Leave Request Detail API Route
 *
 * Forwards to the trucking leave request module handlers to keep the API entry
 * point focused on wiring while business logic lives under /modules.
 */

export {
  GET,
  DELETE,
} from '@/modules/trucking/employees/leave-requests/api/[id]/route';
