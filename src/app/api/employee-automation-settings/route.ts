import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  getEmployeeAutomationSettings,
  updateEmployeeAutomationSettings,
  type EmployeeAutomationSettingsUpdate,
} from '@/lib/settings/employeeAutomation';
import { runStayInAutoPresenceAutomation } from '@/lib/automation/stayInAutoPresence';

// Note: Input validation is handled by the service layer (employeeAutomation.ts)
// which includes sanitization and validation for all fields:
// - stayInAutoPresenceTime: HH:mm format validation
// - stayInAutoPresenceGraceMinutes: numeric validation with min/max
// - stayInAutoPresenceTimezone: non-empty string validation
// - stayInAutoPresenceEnabled: boolean coercion

export async function GET() {
  try {
    const settings = await getEmployeeAutomationSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching employee automation settings:', error);
    return NextResponse.json(
      { error: 'Failed to load employee automation settings.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json()) as EmployeeAutomationSettingsUpdate;
    const updated = await updateEmployeeAutomationSettings(payload);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating employee automation settings:', error);

    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to update employee automation settings.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await runStayInAutoPresenceAutomation();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error running stay-in automation manually:', error);

    return NextResponse.json(
      { error: 'Failed to run automation. Please try again later.' },
      { status: 500 }
    );
  }
}
