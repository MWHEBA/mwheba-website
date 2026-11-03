import { draftMode } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isValidLocale, defaultLocale } from '@/shared/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { hasRole } from '@/modules/identity/access/roles';
import { verifyPreviewToken } from '@/modules/content/lib/previewTokens';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const slug = searchParams.get('slug') || '';
  const localeParam = searchParams.get('locale');

  const locale = localeParam && isValidLocale(localeParam) ? localeParam : defaultLocale;

  // 1. Verify Page-Specific Signed Preview Token (Never accept raw secrets)
  if (!token) {
    return NextResponse.json(
      {
        error: 'MISSING_PREVIEW_TOKEN',
        message: 'Missing page-specific preview token. Direct secret URLs are disallowed.',
      },
      { status: 401 }
    );
  }

  const tokenVerification = verifyPreviewToken(token, {
    expectedSlug: slug,
    expectedLocale: locale,
  });

  if (!tokenVerification.valid) {
    const isMismatch =
      tokenVerification.error === 'PAGE_MISMATCH' ||
      tokenVerification.error === 'LOCALE_MISMATCH';

    return NextResponse.json(
      {
        error: isMismatch ? 'PREVIEW_TOKEN_MISMATCH' : 'INVALID_PREVIEW_TOKEN',
        message:
          tokenVerification.error === 'PAGE_MISMATCH'
            ? 'Preview token was issued for a different page and cannot be reused for this slug.'
            : tokenVerification.error === 'LOCALE_MISMATCH'
            ? 'Preview token was issued for a different language version.'
            : tokenVerification.error === 'TOKEN_EXPIRED'
            ? 'Preview token has expired. Please regenerate preview from Payload Admin.'
            : 'Preview token signature verification failed.',
        code: tokenVerification.error,
      },
      { status: isMismatch ? 403 : 401 }
    );
  }

  // 2. Authenticate user from session headers/cookies and verify editor role
  try {
    const payload = await getPayloadClient();
    const { user } = await payload.auth({ headers: req.headers });

    if (!user) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED_PREVIEW',
          message: 'Authentication required. You must be logged into Payload Admin to preview drafts.',
        },
        { status: 401 }
      );
    }

    if (!hasRole(user, ['super_admin', 'marketer'])) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN_PREVIEW',
          message: 'Forbidden. Only users with super_admin or marketer role are permitted to preview draft pages.',
        },
        { status: 403 }
      );
    }
  } catch (authError) {
    return NextResponse.json(
      {
        error: 'AUTH_VERIFICATION_FAILED',
        message: 'Could not verify editor session credentials.',
      },
      { status: 500 }
    );
  }

  // 3. Resolve target localized path and enable Draft Mode
  const targetPath = slug ? `/${locale}/${slug}` : `/${locale}`;

  const draft = await draftMode();
  draft.enable();

  return NextResponse.redirect(new URL(targetPath, req.url));
}
