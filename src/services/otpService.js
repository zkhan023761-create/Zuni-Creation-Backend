import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import OTP from '../models/OTP.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const OTP_EXPIRY_MINUTES = 10;
const BCRYPT_SALT_ROUNDS  = 10;



// ── Generate a 6-digit numeric OTP ────────────────────────────────────────
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Build branded OTP email HTML ──────────────────────────────────────────
function buildOtpEmail(code, purpose, name = '') {
  const purposeLabel =
    purpose === 'registration'   ? 'verify your email' :
    purpose === 'password_reset' ? 'reset your password' :
                                   'log in to your account';
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, serif; background: #faf8f5; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #5c6b3a, #7a8c4a); padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px; }
    .header p  { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 17px; color: #3d2c1e; margin-bottom: 12px; }
    .message  { color: #5a4535; line-height: 1.7; margin-bottom: 24px; font-size: 15px; }
    .otp-box  { background: #f4f7e8; border: 2px dashed #6b7a3e; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .otp-code { font-size: 42px; font-weight: bold; letter-spacing: 10px; color: #4a3520; font-family: monospace; }
    .expiry   { color: #8a7060; font-size: 13px; margin-top: 8px; }
    .footer   { background: #faf8f5; padding: 18px 32px; text-align: center; border-top: 1px solid #e8e0d5; }
    .footer p { color: #8a7060; font-size: 12px; margin: 3px 0; }
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
      <p class="greeting">${greeting}</p>
      <p class="message">
        Use the code below to <strong>${purposeLabel}</strong>.<br/>
        This code is valid for <strong>${OTP_EXPIRY_MINUTES} minutes</strong> and can only be used once.
      </p>
      <div class="otp-box">
        <div class="otp-code">${code}</div>
        <p class="expiry">⏱ Expires in ${OTP_EXPIRY_MINUTES} minutes</p>
      </div>
      <p class="message" style="font-size:13px; color:#8a7060;">
        If you did not request this code, please ignore this email.
      </p>
    </div>
    <div class="footer">
      <p><strong>Zunaira</strong> · Zuniii Creation</p>
      <p>📞 +91 99670 01963 · <a href="mailto:zuniicreation@gmail.com">zuniicreation@gmail.com</a></p>
      <p><a href="https://www.instagram.com/zuniii_creation/">@zuniii_creation</a> · Mumbai, Maharashtra</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Send OTP: email first, then persist ───────────────────────────────────
export async function sendOtp(email, purpose, name = '') {
  const code = generateCode();

  // 1. Send email FIRST (fail fast before any DB write)
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email service not configured. Please set RESEND_API_KEY in .env');
  }

  const subjectMap = {
    registration:   '🌸 Verify your email — Zuniii Creation',
    login:          '🔐 Your login OTP — Zuniii Creation',
    password_reset: '🔑 Reset your password — Zuniii Creation',
  };

  const { data, error } = await resend.emails.send({
    from: `"Zuniii Creation 🌸" <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
    to:   email,
    subject: subjectMap[purpose],
    html: buildOtpEmail(code, purpose, name),
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  // 2. Email sent — now hash and persist (delete any existing OTP first)
  await OTP.deleteMany({ email, purpose });

  const hashedOtp = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OTP.create({ email, hashedOtp, purpose, expiresAt });
  console.log(`✅ OTP sent to ${email} for ${purpose}`);
}

// ── Validate OTP ──────────────────────────────────────────────────────────
export async function validateOtp(email, code, purpose) {
  const otpDoc = await OTP.findOne({ email, purpose }).sort({ createdAt: -1 });

  if (!otpDoc) {
    const err = new Error('OTP not found or already used');
    err.code = 'OTP_NOT_FOUND';
    throw err;
  }

  if (otpDoc.expiresAt < new Date()) {
    await OTP.deleteOne({ _id: otpDoc._id });
    const err = new Error('OTP has expired');
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  const isMatch = await bcrypt.compare(code, otpDoc.hashedOtp);
  if (!isMatch) {
    const err = new Error('Invalid OTP');
    err.code = 'OTP_INVALID';
    throw err;
  }

  // Single-use: delete after successful validation
  await OTP.deleteOne({ _id: otpDoc._id });
  return true;
}
