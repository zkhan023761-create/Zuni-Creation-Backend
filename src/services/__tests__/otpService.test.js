/**
 * Unit tests for otpService.js
 *
 * Validates: Requirements 1.2, 1.4, 1.5, 7.4
 *
 * Uses jest.unstable_mockModule for ESM-compatible mocking.
 * All mocks are set up BEFORE the dynamic import of the module under test.
 */

import { jest } from '@jest/globals';

// ── Mock nodemailer ────────────────────────────────────────────────────────
let mockSendMail;

jest.unstable_mockModule('nodemailer', () => {
  mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
  return {
    default: {
      createTransport: jest.fn(() => ({
        sendMail: mockSendMail,
      })),
    },
  };
});

// ── Mock OTP Mongoose model ────────────────────────────────────────────────
// Path is relative to the module under test (otpService.js lives in src/services/)
jest.unstable_mockModule('../../models/OTP.js', () => ({
  default: {
    findOne: jest.fn(),
    deleteMany: jest.fn(),
    deleteOne: jest.fn(),
    create: jest.fn(),
  },
}));

// ── Dynamic imports AFTER mocks are registered ────────────────────────────
const { sendOtp, validateOtp } = await import('../otpService.js');
const { default: OTP } = await import('../../models/OTP.js');
const { default: nodemailer } = await import('nodemailer');

// ── Test setup ────────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.EMAIL_USER = 'test@example.com';
  process.env.EMAIL_PASS = 'test-password';
});

beforeEach(() => {
  jest.clearAllMocks();
  // Re-assign mockSendMail reference after clearAllMocks resets the mock
  mockSendMail = nodemailer.createTransport().sendMail;
  mockSendMail.mockResolvedValue({ messageId: 'test-id' });
  OTP.deleteMany.mockResolvedValue({});
  OTP.create.mockResolvedValue({});
});

// ═══════════════════════════════════════════════════════════════════════════
// generateCode() — tested indirectly via sendOtp
// ═══════════════════════════════════════════════════════════════════════════

describe('generateCode() — tested indirectly via sendOtp', () => {
  test('OTP sent in email always matches /^\\d{6}$/', async () => {
    // Capture the code that was embedded in the email HTML
    let capturedHtml = '';
    mockSendMail.mockImplementation(async (mailOptions) => {
      capturedHtml = mailOptions.html;
      return { messageId: 'test-id' };
    });

    await sendOtp('user@example.com', 'registration');

    // The 6-digit code appears in the otp-code div
    const match = capturedHtml.match(/<div class="otp-code">(\d+)<\/div>/);
    expect(match).not.toBeNull();
    const code = match[1];
    expect(code).toMatch(/^\d{6}$/);
  });

  test('OTP code is always exactly 6 digits across multiple calls', async () => {
    const codes = [];

    mockSendMail.mockImplementation(async (mailOptions) => {
      const match = mailOptions.html.match(/<div class="otp-code">(\d+)<\/div>/);
      if (match) codes.push(match[1]);
      return { messageId: 'test-id' };
    });

    // Run sendOtp several times to check consistency
    for (let i = 0; i < 5; i++) {
      await sendOtp('user@example.com', 'registration');
    }

    expect(codes).toHaveLength(5);
    for (const code of codes) {
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// sendOtp() — success path
// ═══════════════════════════════════════════════════════════════════════════

describe('sendOtp() — success path', () => {
  test('calls sendMail with correct recipient and subject for registration', async () => {
    await sendOtp('user@example.com', 'registration');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mailArgs = mockSendMail.mock.calls[0][0];
    expect(mailArgs.to).toBe('user@example.com');
    expect(mailArgs.subject).toContain('Verify your email');
  });

  test('calls sendMail with correct subject for login', async () => {
    await sendOtp('user@example.com', 'login');

    const mailArgs = mockSendMail.mock.calls[0][0];
    expect(mailArgs.subject).toContain('login OTP');
  });

  test('deletes existing OTP documents before creating a new one', async () => {
    await sendOtp('user@example.com', 'registration');

    expect(OTP.deleteMany).toHaveBeenCalledWith({
      email: 'user@example.com',
      purpose: 'registration',
    });
  });

  test('creates an OTP document after successful email send', async () => {
    await sendOtp('user@example.com', 'registration');

    expect(OTP.create).toHaveBeenCalledTimes(1);
    const createArgs = OTP.create.mock.calls[0][0];
    expect(createArgs.email).toBe('user@example.com');
    expect(createArgs.purpose).toBe('registration');
    expect(typeof createArgs.hashedOtp).toBe('string');
    expect(createArgs.hashedOtp.length).toBeGreaterThan(0);
    expect(createArgs.expiresAt).toBeInstanceOf(Date);
  });

  test('OTP document expiresAt is approximately 10 minutes in the future', async () => {
    const before = Date.now();
    await sendOtp('user@example.com', 'registration');
    const after = Date.now();

    const createArgs = OTP.create.mock.calls[0][0];
    const expiresAt = createArgs.expiresAt.getTime();

    // Should be between 9m59s and 10m01s from now
    expect(expiresAt).toBeGreaterThanOrEqual(before + 9 * 60 * 1000 + 59 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(after + 10 * 60 * 1000 + 1000);
  });

  test('stored hash is not equal to the plain-text code', async () => {
    let capturedCode = '';
    mockSendMail.mockImplementation(async (mailOptions) => {
      const match = mailOptions.html.match(/<div class="otp-code">(\d+)<\/div>/);
      if (match) capturedCode = match[1];
      return { messageId: 'test-id' };
    });

    await sendOtp('user@example.com', 'registration');

    const createArgs = OTP.create.mock.calls[0][0];
    expect(createArgs.hashedOtp).not.toBe(capturedCode);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// sendOtp() — failure path (email transporter throws)
// ═══════════════════════════════════════════════════════════════════════════

describe('sendOtp() — failure path', () => {
  test('throws when transporter.sendMail throws', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(sendOtp('user@example.com', 'registration')).rejects.toThrow(
      'SMTP connection refused'
    );
  });

  test('does NOT call OTP.deleteMany when sendMail throws', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP error'));

    await expect(sendOtp('user@example.com', 'registration')).rejects.toThrow();

    expect(OTP.deleteMany).not.toHaveBeenCalled();
  });

  test('does NOT create an OTP document when sendMail throws', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP error'));

    await expect(sendOtp('user@example.com', 'registration')).rejects.toThrow();

    expect(OTP.create).not.toHaveBeenCalled();
  });

  test('throws when EMAIL_USER is not set', async () => {
    const originalUser = process.env.EMAIL_USER;
    delete process.env.EMAIL_USER;

    await expect(sendOtp('user@example.com', 'registration')).rejects.toThrow(
      'Email service not configured'
    );

    process.env.EMAIL_USER = originalUser;
  });

  test('throws when EMAIL_PASS is not set', async () => {
    const originalPass = process.env.EMAIL_PASS;
    delete process.env.EMAIL_PASS;

    await expect(sendOtp('user@example.com', 'registration')).rejects.toThrow(
      'Email service not configured'
    );

    process.env.EMAIL_PASS = originalPass;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateOtp() — valid code
// ═══════════════════════════════════════════════════════════════════════════

describe('validateOtp() — valid code', () => {
  test('returns true for a valid, unexpired OTP', async () => {
    // We need a real bcrypt hash to test the compare path
    const { default: bcrypt } = await import('bcryptjs');
    const plainCode = '123456';
    const hashedOtp = await bcrypt.hash(plainCode, 10);

    OTP.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: 'doc-id-1',
        email: 'user@example.com',
        hashedOtp,
        purpose: 'registration',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min in future
      }),
    });
    OTP.deleteOne.mockResolvedValue({});

    const result = await validateOtp('user@example.com', plainCode, 'registration');

    expect(result).toBe(true);
  });

  test('deletes the OTP document after successful validation', async () => {
    const { default: bcrypt } = await import('bcryptjs');
    const plainCode = '654321';
    const hashedOtp = await bcrypt.hash(plainCode, 10);
    const docId = 'doc-id-2';

    OTP.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: docId,
        email: 'user@example.com',
        hashedOtp,
        purpose: 'login',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }),
    });
    OTP.deleteOne.mockResolvedValue({});

    await validateOtp('user@example.com', plainCode, 'login');

    expect(OTP.deleteOne).toHaveBeenCalledWith({ _id: docId });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateOtp() — wrong code
// ═══════════════════════════════════════════════════════════════════════════

describe('validateOtp() — wrong code', () => {
  test('throws OTP_INVALID when the submitted code does not match the hash', async () => {
    const { default: bcrypt } = await import('bcryptjs');
    const correctCode = '111111';
    const wrongCode = '999999';
    const hashedOtp = await bcrypt.hash(correctCode, 10);

    OTP.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: 'doc-id-3',
        email: 'user@example.com',
        hashedOtp,
        purpose: 'registration',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }),
    });

    const error = await validateOtp('user@example.com', wrongCode, 'registration').catch(
      (e) => e
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('OTP_INVALID');
    expect(error.message).toBe('Invalid OTP');
  });

  test('does NOT delete the OTP document when code is wrong', async () => {
    const { default: bcrypt } = await import('bcryptjs');
    const hashedOtp = await bcrypt.hash('111111', 10);

    OTP.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: 'doc-id-4',
        email: 'user@example.com',
        hashedOtp,
        purpose: 'registration',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }),
    });

    await validateOtp('user@example.com', '999999', 'registration').catch(() => {});

    expect(OTP.deleteOne).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateOtp() — expired OTP
// ═══════════════════════════════════════════════════════════════════════════

describe('validateOtp() — expired OTP', () => {
  test('throws OTP_EXPIRED when expiresAt is in the past', async () => {
    const { default: bcrypt } = await import('bcryptjs');
    const hashedOtp = await bcrypt.hash('123456', 10);
    const docId = 'doc-id-5';

    OTP.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: docId,
        email: 'user@example.com',
        hashedOtp,
        purpose: 'registration',
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      }),
    });
    OTP.deleteOne.mockResolvedValue({});

    const error = await validateOtp('user@example.com', '123456', 'registration').catch(
      (e) => e
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('OTP_EXPIRED');
    expect(error.message).toBe('OTP has expired');
  });

  test('deletes the expired OTP document', async () => {
    const { default: bcrypt } = await import('bcryptjs');
    const hashedOtp = await bcrypt.hash('123456', 10);
    const docId = 'doc-id-6';

    OTP.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: docId,
        email: 'user@example.com',
        hashedOtp,
        purpose: 'registration',
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
      }),
    });
    OTP.deleteOne.mockResolvedValue({});

    await validateOtp('user@example.com', '123456', 'registration').catch(() => {});

    expect(OTP.deleteOne).toHaveBeenCalledWith({ _id: docId });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateOtp() — missing OTP
// ═══════════════════════════════════════════════════════════════════════════

describe('validateOtp() — missing OTP', () => {
  test('throws OTP_NOT_FOUND when no OTP document exists', async () => {
    OTP.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    });

    const error = await validateOtp('user@example.com', '123456', 'registration').catch(
      (e) => e
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('OTP_NOT_FOUND');
    expect(error.message).toBe('OTP not found or already used');
  });

  test('does NOT call deleteOne when OTP document is not found', async () => {
    OTP.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    });

    await validateOtp('user@example.com', '123456', 'registration').catch(() => {});

    expect(OTP.deleteOne).not.toHaveBeenCalled();
  });
});
