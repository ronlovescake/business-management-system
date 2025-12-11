import { redirect } from 'next/navigation';

export default function LegacyTruckAssignmentsPage() {
  redirect('/trucking/operations/vehicle-assignments');
}
