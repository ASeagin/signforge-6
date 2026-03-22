// emails/mailer.js
const https = require('https');

function sendEmail({ to, subject, html }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      from: 'SignForge <onboarding@resend.dev>',
      to: [to],
      subject,
      html
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          console.error('Resend error:', data);
          resolve(null); // Don't crash if email fails
        }
      });
    });

    req.on('error', err => {
      console.error('Email error:', err);
      resolve(null); // Don't crash if email fails
    });

    req.write(body);
    req.end();
  });
}

// Welcome email
async function sendWelcome(user) {
  return sendEmail({
    to: user.email,
    subject: 'Welcome to SignForge! 🎉',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#07090f;color:#e2e8f8;padding:40px;border-radius:16px">
        <h1 style="background:linear-gradient(135deg,#a78bfa,#06d6a0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2rem;margin-bottom:8px">SignForge</h1>
        <h2 style="color:#f0f4ff;margin-bottom:16px">Welcome, ${user.name}! 👋</h2>
        <p style="color:rgba(226,232,248,.7);line-height:1.7">Your account is ready. You have <strong style="color:#a78bfa">1 free document signing</strong> to try out.</p>
        <div style="margin:28px 0">
          <a href="https://signforge-6-wtru.onrender.com/sign" style="background:linear-gradient(135deg,#635bff,#4f46e5);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Sign your first document →</a>
        </div>
        <p style="color:rgba(226,232,248,.4);font-size:.85rem">If you didn't create this account, ignore this email.</p>
      </div>
    `
  });
}

// Password reset email
async function sendPasswordReset(user, token) {
  const link = `https://signforge-6-wtru.onrender.com/reset?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: 'Reset your SignForge password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#07090f;color:#e2e8f8;padding:40px;border-radius:16px">
        <h1 style="background:linear-gradient(135deg,#a78bfa,#06d6a0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2rem;margin-bottom:8px">SignForge</h1>
        <h2 style="color:#f0f4ff;margin-bottom:16px">Reset your password</h2>
        <p style="color:rgba(226,232,248,.7);line-height:1.7">Click the button below to set a new password. This link expires in 1 hour.</p>
        <div style="margin:28px 0">
          <a href="${link}" style="background:linear-gradient(135deg,#635bff,#4f46e5);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Reset password →</a>
        </div>
        <p style="color:rgba(226,232,248,.4);font-size:.85rem">If you didn't request this, ignore this email. Your password won't change.</p>
      </div>
    `
  });
}

// Payment confirmation email
async function sendPaymentConfirmation(user) {
  return sendEmail({
    to: user.email,
    subject: '✅ Your SignForge subscription is active!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#07090f;color:#e2e8f8;padding:40px;border-radius:16px">
        <h1 style="background:linear-gradient(135deg,#a78bfa,#06d6a0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2rem;margin-bottom:8px">SignForge</h1>
        <h2 style="color:#06d6a0;margin-bottom:16px">Payment confirmed! 🎉</h2>
        <p style="color:rgba(226,232,248,.7);line-height:1.7">Your <strong style="color:#a78bfa">${user.plan === 'pro' ? 'Pro' : 'Starter'}</strong> plan is now active.</p>
        <div style="margin:28px 0">
          <a href="https://signforge-6-wtru.onrender.com/dashboard" style="background:linear-gradient(135deg,#06d6a0,#059669);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Go to Dashboard →</a>
        </div>
      </div>
    `
  });
}

module.exports = { sendWelcome, sendPasswordReset, sendPaymentConfirmation };
