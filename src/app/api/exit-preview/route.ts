import { draftMode } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const redirectParam = searchParams.get('redirect') || '/ar';

  const draft = await draftMode();
  draft.disable();

  return NextResponse.redirect(new URL(redirectParam, req.url));
}
