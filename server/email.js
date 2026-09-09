// AP Workspace — password-reset email
//
// Supabase sent these automatically; self-hosting needs an explicit
// provider. Uses Resend's HTTP API (no SDK dependency needed — one fetch).
// Falls back to logging the link to the console when RESEND_API_KEY isn't
// set, so local development and testing never require a live email account.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESET_EMAIL_FROM || 'AP Workspace <noreply@anjanpatel.ca>';

async function sendResetEmail(toEmail, resetUrl) {
  if (!RESEND_API_KEY) {
    console.log(`[email:dev-mode] Password reset link for ${toEmail}: ${resetUrl}`);
    return;
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: toEmail,
      subject: 'Reset your AP Workspace password',
      html: `<p>Someone requested a password reset for your AP Workspace account.</p>
             <p><a href="${resetUrl}">Click here to set a new password</a> (expires in 1 hour).</p>
             <p>If you didn't request this, you can ignore this email.</p>`,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Failed to send reset email: ${resp.status} ${body}`);
  }
}

module.exports = { sendResetEmail };
