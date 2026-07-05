/**
 * ClarityOS Lead Magnet - Email Capture Endpoint
 *
 * Captures email from the diagnostic download form and:
 * 1. Stores the lead for Sofia (sales agent follow-up)
 * 2. Sends the one-pager PDF to the user's email
 * 3. Returns a success response so the page can trigger the download
 */

// Sofia's notification email (where leads go)
const SOFIA_EMAIL = 'clarityos@global-mkts.com';
// Your site URL
const SITE_URL = 'https://clarity-check.global-mkts.com';

// CORS headers for the form submission
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Log the lead (visible in Cloudflare Pages logs)
    console.log(`[LEAD] New lead captured: ${email}${name ? ` (${name})` : ''} at ${new Date().toISOString()}`);

    // For now, send via email-to-SMS or store in KV
    // We use a webhook-style approach — you can connect this to any CRM later
    const leadData = {
      source: 'clarity-check-diagnostic',
      type: 'lead-magnet-download',
      email: email,
      name: name || email.split('@')[0],
      captured_at: new Date().toISOString(),
      page: '5 Signs Organizational Clarity Diagnostic',
    };

    // Store in Cloudflare KV if bound, otherwise log
    // To enable KV, add a KV namespace binding named 'LEADS' in your Pages project settings
    try {
      if (context.env && context.env.LEADS) {
        await context.env.LEADS.put(
          `lead:${Date.now()}`,
          JSON.stringify(leadData)
        );
      }
    } catch (kvErr) {
      console.error('[LEAD] KV store unavailable, logging only:', kvErr.message);
    }

    // Send notification email via MailChannels (available on Cloudflare Pages)
    // MailChannels is a free outbound email service integrated with Cloudflare
    try {
      const emailPayload = {
        personalizations: [{ to: [{ email: SOFIA_EMAIL }] }],
        from: { email: 'noreply@clarity-check.global-mkts.com', name: 'ClarityOS Lead Capture' },
        subject: `New Lead: ${leadData.name} downloaded the Clarity Diagnostic`,
        content: [
          {
            type: 'text/plain',
            value: [
              `New Lead Captured`,
              `==================`,
              ``,
              `Name:  ${leadData.name}`,
              `Email: ${leadData.email}`,
              `Date:  ${leadData.captured_at}`,
              `Source: ${leadData.source}`,
              `Page:  ${leadData.page}`,
              ``,
              `Action: Follow up with a personalized ClarityOS introduction.`,
              ``,
              `---`,
              `ClarityOS Lead Capture`,
              `https://clarity-check.global-mkts.com`,
            ].join('\n'),
          },
        ],
      };

      const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });

      console.log(`[LEAD] Email notification sent: ${emailResponse.status}`);
    } catch (emailErr) {
      console.error('[LEAD] Email notification failed:', emailErr.message);
      // Non-blocking — don't fail the request if email fails
    }

    // Also send a confirmation to the user with the PDF link
    try {
      const confirmPayload = {
        personalizations: [{ to: [{ email: email }] }],
        from: { email: 'clarityos@global-mkts.com', name: 'Zeeshan Sabri · ClarityOS' },
        subject: 'Your ClarityOS Diagnostic One-Pager',
        content: [
          {
            type: 'text/html',
            value: [
              `<div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0a0a0f; color: #e4e4ed;">`,
              `<h1 style="color: #fff; font-size: 22px; margin-bottom: 8px;">Your Diagnostic One-Pager</h1>`,
              `<hr style="border: none; border-top: 1px solid rgba(136,136,204,0.15); margin: 16px 0;">`,
              `<p style="color: #9999bb; line-height: 1.6;">Thanks for checking out the 5 Signs diagnostic. Below is your one-pager — a snapshot of the clarity gaps most organizations face and how to identify them.</p>`,
              `<div style="margin: 24px 0; text-align: center;">`,
              `<a href="${SITE_URL}/clarityos-diagnostic-one-pager.pdf" style="display: inline-block; background: linear-gradient(135deg, #6666cc, #8855ee); color: #fff; font-weight: 600; padding: 14px 32px; border-radius: 12px; text-decoration: none;">Download Your One-Pager</a>`,
              `</div>`,
              `<p style="color: #9999bb; line-height: 1.6;">If you'd like to go deeper, I offer a <strong style="color: #ccccee;">ClarityOS Mirror Call</strong> — a one-hour session where we map your organization's decision architecture and identify the #1 blocker to execution. <a href="${SITE_URL}/#mirror-call" style="color: #8888cc;">Book yours here.</a></p>`,
              `<hr style="border: none; border-top: 1px solid rgba(136,136,204,0.06); margin: 16px 0;">`,
              `<p style="font-size: 12px; color: #555577;">Zeeshan Sabri · ClarityOS · <a href="https://clarity-os.com" style="color: #7777aa;">clarity-os.com</a></p>`,
              `</div>`,
            ].join('\n'),
          },
        ],
      };

      await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmPayload),
      });

      console.log(`[LEAD] Confirmation email sent to ${email}`);
    } catch (confirmErr) {
      console.error('[LEAD] Confirmation email failed:', confirmErr.message);
    }

    // Return success — frontend will trigger the PDF download
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thanks! Your one-pager is ready to download.',
        downloadUrl: '/clarityos-diagnostic-one-pager.pdf',
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    console.error('[LEAD] Error processing submission:', err.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
}
