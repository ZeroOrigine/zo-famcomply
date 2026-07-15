// CANONICAL: FamComply daily job.
// 1. Refreshes requirement statuses so due_soon and overdue stay honest as days pass.
// 2. Sends the email reminders promised on the Pro plan, via the Resend HTTP API.
// Secured with CRON_SECRET (Authorization: Bearer <secret>). Service role only.
// This route exists so the 'email reminders' promise in the plans and on the
// landing page is actually delivered, not just advertised.
import type { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getEntitlementsForUsers } from '@/lib/db/entitlements';
import { apiError, apiSuccess, normalizeEmbedded, unexpectedError } from '@/lib/db/api-helpers';
import { daysFromTodayUtc, formatDateUtc, todayUtcIsoDate } from '@/lib/db/dates';

export const dynamic = 'force-dynamic';

interface DueRequirementSummary {
  id: string;
  title: string;
  expires_on: string | null;
  completed_on: string | null;
}

interface DueReminderRow {
  id: string;
  user_id: string;
  requirement_id: string;
  remind_on: string;
  requirement: DueRequirementSummary | DueRequirementSummary[] | null;
}

interface ProfileContact {
  id: string;
  email: string | null;
  full_name: string;
}

interface ReminderEmail {
  subject: string;
  text: string;
  html: string;
}

interface DailyJobSummary {
  statuses_refreshed: number;
  email_configured: boolean;
  reminders_due: number;
  emails_sent: number;
  emails_failed: number;
  reminders_canceled: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReminderEmail(input: {
  recipientName: string;
  requirementTitle: string;
  expiresOnIso: string;
}): ReminderEmail {
  const daysUntil = daysFromTodayUtc(input.expiresOnIso);
  const prettyDate = formatDateUtc(input.expiresOnIso);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const firstName = input.recipientName.trim().split(' ')[0] || 'there';

  let subject: string;
  let statusLine: string;
  let actionLine: string;

  if (daysUntil > 1) {
    subject = `${input.requirementTitle}: ${daysUntil} days left`;
    statusLine = `Your ${input.requirementTitle} expires on ${prettyDate}. That is ${daysUntil} days from now.`;
    actionLine = 'Book the renewal now, while there is still room on the calendar.';
  } else if (daysUntil === 1) {
    subject = `${input.requirementTitle} expires tomorrow`;
    statusLine = `Your ${input.requirementTitle} expires tomorrow, ${prettyDate}.`;
    actionLine = 'If it is already handled, mark it done in FamComply and this thread goes quiet.';
  } else if (daysUntil === 0) {
    subject = `${input.requirementTitle} expires today`;
    statusLine = `Your ${input.requirementTitle} expires today, ${prettyDate}.`;
    actionLine = 'Handle it today if you can. A lapse here can hold up your license.';
  } else {
    const overdueDays = Math.abs(daysUntil);
    subject = `Action needed: ${input.requirementTitle} has expired`;
    statusLine = `Your ${input.requirementTitle} expired on ${prettyDate}. That was ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} ago.`;
    actionLine = 'Renew it as soon as you can, then mark it done so your timeline stays accurate.';
  }

  const textLines = [`Hi ${firstName},`, '', statusLine, '', actionLine];
  if (appUrl !== '') {
    textLines.push('', `See your full timeline: ${appUrl}/dashboard`);
  }
  textLines.push(
    '',
    'FamComply keeps CPR, first aid, background checks, and license renewal on one sequenced timeline.'
  );
  const text = textLines.join('\n');

  const buttonHtml =
    appUrl !== ''
      ? `<p style="margin: 0 0 24px;"><a href="${appUrl}/dashboard" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 15px; font-weight: 600;">Open your timeline</a></p>`
      : '';

  const html = [
    '<div style="font-family: -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1f2937;">',
    '<p style="font-size: 14px; font-weight: 700; color: #0f766e; margin: 0 0 16px;">FamComply</p>',
    `<p style="font-size: 16px; margin: 0 0 12px;">Hi ${escapeHtml(firstName)},</p>`,
    `<p style="font-size: 16px; line-height: 1.6; margin: 0 0 12px;">${escapeHtml(statusLine)}</p>`,
    `<p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">${escapeHtml(actionLine)}</p>`,
    buttonHtml,
    '<p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0;">You are getting this because email reminders are on for your FamComply account. You can cancel any reminder from your dashboard.</p>',
    '</div>',
  ].join('');

  return { subject, text, html };
}

async function sendEmail(
  resendApiKey: string,
  recipientEmail: string,
  email: ReminderEmail
): Promise<boolean> {
  const fromAddress = process.env.REMINDER_FROM_EMAIL ?? 'FamComply <onboarding@resend.dev>';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('[famcomply] Resend rejected an email:', response.status, detail);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[famcomply] Email send failed:', error);
    return false;
  }
}

async function runDailyJob(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Fail closed: without a secret this endpoint stays off.
    return apiError(
      'The daily job is not configured yet. Set CRON_SECRET to turn it on.',
      'CRON_NOT_CONFIGURED',
      503
    );
  }

  const authorizationHeader = request.headers.get('authorization') ?? '';
  if (authorizationHeader !== `Bearer ${cronSecret}`) {
    return apiError('This endpoint is for the scheduled job only.', 'UNAUTHORIZED', 401);
  }

  try {
    const adminClient = getSupabaseAdminClient();

    const summary: DailyJobSummary = {
      statuses_refreshed: 0,
      email_configured: false,
      reminders_due: 0,
      emails_sent: 0,
      emails_failed: 0,
      reminders_canceled: 0,
    };

    // Phase 1: keep every requirement status honest as calendar days pass.
    const { data: refreshResult, error: refreshError } = await adminClient.rpc(
      'famcomply_refresh_requirement_statuses'
    );
    if (refreshError) {
      console.error('[famcomply] status refresh failed:', refreshError);
    } else {
      summary.statuses_refreshed = typeof refreshResult === 'number' ? refreshResult : 0;
    }

    // Phase 2: deliver due reminders.
    const resendApiKey = process.env.RESEND_API_KEY ?? '';
    summary.email_configured = resendApiKey !== '';
    if (resendApiKey === '') {
      // Leave reminders pending so nothing is lost. They go out on the first
      // run after RESEND_API_KEY is configured.
      return apiSuccess(summary);
    }

    const today = todayUtcIsoDate();
    // Uses famcomply_reminders_due_idx (partial index on pending reminders).
    const { data: dueRows, error: dueError } = await adminClient
      .from('famcomply_reminders')
      .select(
        'id, user_id, requirement_id, remind_on, requirement:famcomply_provider_requirements(id, title, expires_on, completed_on)'
      )
      .eq('status', 'pending')
      .eq('channel', 'email')
      .lte('remind_on', today)
      .order('remind_on', { ascending: true })
      .limit(200);

    if (dueError) {
      return unexpectedError('cron daily (reminders query)', dueError);
    }

    const dueReminders = (dueRows ?? []) as unknown as DueReminderRow[];
    summary.reminders_due = dueReminders.length;
    if (dueReminders.length === 0) {
      return apiSuccess(summary);
    }

    const userIds = Array.from(new Set(dueReminders.map((row) => row.user_id)));

    const { data: profileRows, error: profileError } = await adminClient
      .from('famcomply_profiles')
      .select('id, email, full_name')
      .in('id', userIds);
    if (profileError) {
      return unexpectedError('cron daily (profiles query)', profileError);
    }
    const profilesById = new Map(
      ((profileRows ?? []) as ProfileContact[]).map((profile) => [profile.id, profile] as const)
    );

    const entitlementsByUser = await getEntitlementsForUsers(adminClient, userIds);

    const sentIds: string[] = [];
    const failedIds: string[] = [];
    const canceledIds: string[] = [];

    for (const reminder of dueReminders) {
      const requirement = normalizeEmbedded(reminder.requirement);

      // Belt and suspenders: completed or dateless requirements need no email.
      if (!requirement || requirement.completed_on !== null || requirement.expires_on === null) {
        canceledIds.push(reminder.id);
        continue;
      }

      // Email delivery is a Pro entitlement. Free providers still see due and
      // overdue items on their dashboard timeline, so nothing is hidden.
      const entitlements = entitlementsByUser.get(reminder.user_id);
      if (!entitlements || !entitlements.allowsEmailReminders) {
        canceledIds.push(reminder.id);
        continue;
      }

      const profile = profilesById.get(reminder.user_id);
      const recipientEmail = profile?.email ?? null;
      if (!recipientEmail) {
        failedIds.push(reminder.id);
        continue;
      }

      const email = buildReminderEmail({
        recipientName: profile?.full_name ?? '',
        requirementTitle: requirement.title,
        expiresOnIso: requirement.expires_on,
      });

      const delivered = await sendEmail(resendApiKey, recipientEmail, email);
      if (delivered) {
        sentIds.push(reminder.id);
      } else {
        failedIds.push(reminder.id);
      }
    }

    const nowIso = new Date().toISOString();
    if (sentIds.length > 0) {
      await adminClient
        .from('famcomply_reminders')
        .update({ status: 'sent', sent_at: nowIso })
        .in('id', sentIds);
    }
    if (failedIds.length > 0) {
      await adminClient.from('famcomply_reminders').update({ status: 'failed' }).in('id', failedIds);
    }
    if (canceledIds.length > 0) {
      await adminClient
        .from('famcomply_reminders')
        .update({ status: 'canceled' })
        .in('id', canceledIds);
    }

    summary.emails_sent = sentIds.length;
    summary.emails_failed = failedIds.length;
    summary.reminders_canceled = canceledIds.length;

    return apiSuccess(summary);
  } catch (error) {
    return unexpectedError('/api/cron/daily', error);
  }
}

export async function POST(request: NextRequest) {
  return runDailyJob(request);
}

export async function GET(request: NextRequest) {
  return runDailyJob(request);
}
