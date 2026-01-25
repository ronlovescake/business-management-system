import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  getGeneralMerchandiseEmployeeAutomationSettings,
  updateGeneralMerchandiseEmployeeAutomationSettings,
  type GeneralMerchandiseEmployeeAutomationSettingsUpdate,
} from '@/lib/settings/generalMerchandiseEmployeeAutomation';
import { runGeneralMerchandiseStayInAutoPresenceAutomation } from '@/lib/automation/stayInAutoPresenceGeneralMerchandise';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const settings = await getGeneralMerchandiseEmployeeAutomationSettings();
    return NextResponse.json(settings);
  } catch (error) {
    logger.error('Error fetching GM employee automation settings:', error);
    return NextResponse.json(
      { error: 'Failed to load employee automation settings.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload =
      (await request.json()) as GeneralMerchandiseEmployeeAutomationSettingsUpdate;
    const updated =
      await updateGeneralMerchandiseEmployeeAutomationSettings(payload);
    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating GM employee automation settings:', error);

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
    const result = await runGeneralMerchandiseStayInAutoPresenceAutomation();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    logger.error('Error running GM stay-in automation manually:', error);

    return NextResponse.json(
      { error: 'Failed to run automation. Please try again later.' },
      { status: 500 }
    );
  }
}
