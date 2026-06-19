import nodemailer from 'nodemailer';

// ── Gmail OAuth2 transporter ───────────────────────────────────────────────
let transporterInstance = null;

function getTransporter() {
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      },
    });
  }
  return transporterInstance;
}

// ── Guard: check env vars are set ─────────────────────────────────────────
function isEmailConfigured() {
  const required = ['GMAIL_USER', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
  const missing = required.filter((k) => !process.env[k] || process.env[k].startsWith('your_'));
  if (missing.length > 0) {
    console.warn(`⚠️  Email not configured — missing env vars: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// ── Format date nicely ─────────────────────────────────────────────────────
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── Send confirmation email to customer ───────────────────────────────────
export async function sendConfirmationEmail(booking) {
  if (!isEmailConfigured()) return;

  const transporter = getTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, serif; background: #faf8f5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #5c6b3a, #7a8c4a); padding: 36px 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; letter-spacing: 1px; }
    .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .greeting { font-size: 18px; color: #3d2c1e; margin-bottom: 16px; }
    .message { color: #5a4535; line-height: 1.7; margin-bottom: 24px; }
    .details { background: #faf8f5; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; border: 1px solid #e8e0d5; }
    .details h3 { color: #5c6b3a; margin: 0 0 14px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #ede8e0; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #8a7060; font-weight: 600; }
    .detail-value { color: #3d2c1e; text-align: right; max-width: 60%; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { background: #5c6b3a; color: #fff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block; }
    .footer { background: #faf8f5; padding: 20px 32px; text-align: center; border-top: 1px solid #e8e0d5; }
    .footer p { color: #8a7060; font-size: 13px; margin: 4px 0; }
    .footer a { color: #5c6b3a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌸 Zuniii Creation</h1>
      <p>Professional Mehndi Artist · Mumbai</p>
    </div>
    <div class="body">
      <p class="greeting">Dear ${booking.customerName},</p>
      <p class="message">
        Your mehndi booking has been <strong style="color:#5c6b3a">confirmed</strong>! 🎉<br/>
        I'm excited to create a beautiful design for you. Here are your booking details:
      </p>

      <div class="details">
        <h3>Booking Details</h3>
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${formatDate(booking.preferredDate)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Occasion</span>
          <span class="detail-value">${booking.occasion || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Design Style</span>
          <span class="detail-value">${booking.designStyle || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Number of People</span>
          <span class="detail-value">${booking.numberOfPeople}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Address</span>
          <span class="detail-value">${booking.address}, ${booking.city}</span>
        </div>
        ${booking.specialRequests ? `
        <div class="detail-row">
          <span class="detail-label">Special Requests</span>
          <span class="detail-value">${booking.specialRequests}</span>
        </div>` : ''}
      </div>

      <p class="message">
        If you have any questions or need to make changes, feel free to reach out on WhatsApp or call me directly.
      </p>

      <div class="cta">
        <a href="https://wa.me/919967001963?text=Hi%20Zunaira!%20I%20have%20a%20query%20about%20my%20booking.">
          💬 WhatsApp Me
        </a>
      </div>
    </div>
    <div class="footer">
      <p><strong>Zunaira</strong> · Zuniii Creation</p>
      <p>📞 +91 99670 01963 · <a href="mailto:zuniicreation@gmail.com">zuniicreation@gmail.com</a></p>
      <p><a href="https://www.instagram.com/zuniii_creation/">@zuniii_creation</a> · Mumbai, Maharashtra</p>
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"Zuniii Creation 🌸" <${process.env.GMAIL_USER}>`,
    to: booking.email,
    subject: `✅ Booking Confirmed — ${formatDate(booking.preferredDate)} | Zuniii Creation`,
    html,
  });

  console.log(`✅ Confirmation email sent to ${booking.email}`);
}

// ── Build WhatsApp message text for customer ───────────────────────────────
export function buildWhatsAppMessage(booking) {
  const date = formatDate(booking.preferredDate);
  const msg = [
    `🌸 *Zuniii Creation — Booking Confirmed!*`,
    ``,
    `Hi ${booking.customerName}! Your mehndi booking is *confirmed* ✅`,
    ``,
    `📋 *Booking Details:*`,
    `📅 Date: ${date}`,
    `🎉 Occasion: ${booking.occasion || '—'}`,
    `🎨 Style: ${booking.designStyle || '—'}`,
    `👥 People: ${booking.numberOfPeople}`,
    `📍 Address: ${booking.address}, ${booking.city}`,
    booking.specialRequests ? `📝 Notes: ${booking.specialRequests}` : null,
    ``,
    `For any queries, reply to this message.`,
    `— Zunaira | +91 99670 01963`,
  ]
    .filter(Boolean)
    .join('\n');

  return encodeURIComponent(msg);
}

// ── Send completion / thank-you email to customer ─────────────────────────
export async function sendCompletionEmail(booking) {
  if (!isEmailConfigured()) return;

  const transporter = getTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, serif; background: #faf8f5; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #7a5c3a, #a07040); padding: 36px 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 26px; letter-spacing: 1px; }
    .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .greeting { font-size: 18px; color: #3d2c1e; margin-bottom: 16px; }
    .message { color: #5a4535; line-height: 1.7; margin-bottom: 24px; }
    .highlight { background: #faf8f5; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; border: 1px solid #e8e0d5; text-align: center; }
    .highlight p { color: #7a5c3a; font-size: 15px; font-style: italic; margin: 0; line-height: 1.7; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { background: #7a5c3a; color: #fff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-size: 15px; font-weight: 600; display: inline-block; }
    .review { background: #fffbf5; border: 1px dashed #c9a87a; border-radius: 12px; padding: 18px 24px; margin-bottom: 24px; text-align: center; }
    .review p { color: #7a5c3a; font-size: 14px; margin: 0 0 12px; }
    .review a { color: #7a5c3a; font-weight: 700; text-decoration: none; border-bottom: 2px solid #c9a87a; }
    .footer { background: #faf8f5; padding: 20px 32px; text-align: center; border-top: 1px solid #e8e0d5; }
    .footer p { color: #8a7060; font-size: 13px; margin: 4px 0; }
    .footer a { color: #7a5c3a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌸 Zuniii Creation</h1>
      <p>Professional Mehndi Artist · Mumbai</p>
    </div>
    <div class="body">
      <p class="greeting">Dear ${booking.customerName},</p>
      <p class="message">
        Thank you so much for choosing <strong>Zuniii Creation</strong>! 🙏<br/>
        It was an absolute pleasure creating a beautiful mehndi design for you on
        <strong>${formatDate(booking.preferredDate)}</strong>.
        I hope you loved the design and the colour turned out dark and beautiful!
      </p>

      <div class="highlight">
        <p>
          "Every mehndi design I create carries my heart and passion.
          Thank you for trusting me to be part of your special moment." 🌿
        </p>
      </div>

      <p class="message">
        If you enjoyed the experience, I'd love to hear from you! A quick review
        on Google or Instagram helps me reach more customers and keeps me
        motivated to create even more beautiful designs.
      </p>

      <div class="review">
        <p>Share your experience &amp; photos with me!</p>
        <a href="https://www.instagram.com/zuniii_creation/">@zuniii_creation on Instagram</a>
      </div>

      <p class="message">
        Looking forward to being part of your next special occasion. 💕
      </p>

      <div class="cta">
        <a href="https://wa.me/919967001963?text=Hi%20Zunaira!%20I%20want%20to%20book%20again.">
          🌸 Book Again
        </a>
      </div>
    </div>
    <div class="footer">
      <p><strong>Zunaira</strong> · Zuniii Creation</p>
      <p>📞 +91 99670 01963 · <a href="mailto:zuniicreation@gmail.com">zuniicreation@gmail.com</a></p>
      <p><a href="https://www.instagram.com/zuniii_creation/">@zuniii_creation</a> · Mumbai, Maharashtra</p>
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"Zuniii Creation 🌸" <${process.env.GMAIL_USER}>`,
    to: booking.email,
    subject: `🌸 Thank You ${booking.customerName}! Your Mehndi Session is Complete — Zuniii Creation`,
    html,
  });

  console.log(`🌸 Completion thank-you email sent to ${booking.email}`);
}

// ── Build completion WhatsApp message for customer ────────────────────────
export function buildCompletionWhatsAppMessage(booking) {
  const date = formatDate(booking.preferredDate);
  const msg = [
    `🌸 *Zuniii Creation — Thank You!*`,
    ``,
    `Hi ${booking.customerName}! It was a pleasure doing your mehndi on ${date} ✨`,
    ``,
    `I hope you loved the design! 💕`,
    ``,
    `📸 Tag us on Instagram: *@zuniii_creation*`,
    `   Share your photos — we'd love to feature them!`,
    ``,
    `Want to book again for your next occasion?`,
    `Just reply to this message and I'll be happy to help 🌿`,
    ``,
    `— Zunaira | +91 99670 01963`,
  ]
    .filter(Boolean)
    .join('\n');

  return encodeURIComponent(msg);
}
