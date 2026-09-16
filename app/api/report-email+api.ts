type ReportEmailRequest = {
  body?: string;
  fileName?: string;
  pdfBase64?: string;
  recipient?: string;
  subject?: string;
};

type ResendResponse = {
  error?: {
    message?: string;
  };
  id?: string;
  message?: string;
};

const REPORT_EMAIL_DAILY_LIMIT = 10;
const REPORT_EMAIL_MIN_INTERVAL_MS = 60_000;
const REPORT_EMAIL_MAX_ATTACHMENT_BYTES = 700_000;
const rateLimits = new Map<string, { count: number; resetAt: number; updatedAt: number }>();

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(request);

    if (!rateLimit.allowed) {
      return Response.json(
        { error: rateLimit.message },
        {
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
          },
          status: 429,
        }
      );
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = getReportFromEmail();

    if (!apiKey || !from) {
      return Response.json(
        { error: 'Report email is not configured. Add RESEND_API_KEY and RESEND_EMAIL_DOMAIN in Vercel.' },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ReportEmailRequest;
    const recipient = String(body.recipient ?? '').trim();
    const subject = String(body.subject ?? 'Diabeto risk report').trim().slice(0, 140);
    const text = String(body.body ?? 'Attached is a Diabeto risk report.').trim().slice(0, 2000);
    const pdfBase64 = sanitizeBase64(body.pdfBase64);
    const fileName = sanitizeFileName(body.fileName);

    if (!isValidEmail(recipient)) {
      return Response.json({ error: 'Send a valid recipient email.' }, { status: 400 });
    }

    if (!pdfBase64) {
      return Response.json({ error: 'Attach a PDF report.' }, { status: 400 });
    }

    const attachmentBytes = getBase64ByteLength(pdfBase64);

    if (attachmentBytes > REPORT_EMAIL_MAX_ATTACHMENT_BYTES) {
      return Response.json({ error: 'Report PDF is too large to email.' }, { status: 400 });
    }

    const response = await fetch('https://api.resend.com/emails', {
      body: JSON.stringify({
        attachments: [
          {
            content: pdfBase64,
            filename: fileName,
          },
        ],
        from,
        subject,
        text,
        to: [recipient],
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const data = (await response.json()) as ResendResponse;

    if (!response.ok) {
      return Response.json(
        { error: data.error?.message ?? data.message ?? 'Could not send the report email.' },
        { status: response.status }
      );
    }

    return Response.json({ id: data.id ?? null, ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not send the report email.' },
      { status: 500 }
    );
  }
}

function sanitizeBase64(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '');
}

function sanitizeFileName(value: unknown) {
  if (typeof value !== 'string') {
    return 'diabeto-risk-report.pdf';
  }

  const cleanName = value.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
  return cleanName.endsWith('.pdf') ? cleanName : 'diabeto-risk-report.pdf';
}

function getBase64ByteLength(value: string) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getReportFromEmail() {
  const rawValue = process.env.RESEND_EMAIL_DOMAIN?.trim();

  if (!rawValue) {
    return '';
  }

  const withoutProtocol = rawValue.replace(/^https?:\/\//i, '').replace(/^@/, '');
  const withoutPath = withoutProtocol.split('/')[0]?.trim() ?? '';
  const domain = withoutPath.includes('@') ? withoutPath.split('@').pop() ?? '' : withoutPath;

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return '';
  }

  return `Diabeto <diabeto@${domain}>`;
}

function checkRateLimit(request: Request) {
  const now = Date.now();
  const clientId = getClientId(request);
  const existing = rateLimits.get(clientId);
  const current =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + 24 * 60 * 60 * 1000,
          updatedAt: 0,
        };
  const cooldownRemaining = REPORT_EMAIL_MIN_INTERVAL_MS - (now - current.updatedAt);

  if (cooldownRemaining > 0) {
    return {
      allowed: false,
      message: 'Please wait a minute before sending another report.',
      retryAfterMs: cooldownRemaining,
    };
  }

  if (current.count >= REPORT_EMAIL_DAILY_LIMIT) {
    return {
      allowed: false,
      message: 'Report email limit reached for today. Try again tomorrow.',
      retryAfterMs: current.resetAt - now,
    };
  }

  rateLimits.set(clientId, {
    count: current.count + 1,
    resetAt: current.resetAt,
    updatedAt: now,
  });

  cleanupRateLimits(now);

  return { allowed: true, message: '', retryAfterMs: 0 };
}

function getClientId(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();

  return forwardedFor || realIp || 'unknown-client';
}

function cleanupRateLimits(now: number) {
  if (rateLimits.size < 1000) {
    return;
  }

  for (const [key, value] of rateLimits) {
    if (value.resetAt <= now) {
      rateLimits.delete(key);
    }
  }
}
