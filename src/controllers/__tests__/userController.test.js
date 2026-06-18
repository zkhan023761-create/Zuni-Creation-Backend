/**
 * Unit tests for userController.js
 *
 * Validates: Requirements 1.1, 1.6, 2.1, 2.2, 2.3, 3.3, 4.5, 5.1
 *
 * Uses jest.unstable_mockModule for ESM-compatible mocking.
 * All mocks are set up BEFORE the dynamic import of the module under test.
 */

import { jest } from '@jest/globals';

// ── Mock User model ────────────────────────────────────────────────────────
jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

// ── Mock Booking model ─────────────────────────────────────────────────────
jest.unstable_mockModule('../../models/Booking.js', () => ({
  default: {
    find: jest.fn(),
  },
}));

// ── Mock otpService ────────────────────────────────────────────────────────
jest.unstable_mockModule('../../services/otpService.js', () => ({
  sendOtp: jest.fn(),
  validateOtp: jest.fn(),
}));

// ── Dynamic imports AFTER mocks are registered ────────────────────────────
const { register, loginPassword, sendLoginOtp, me, myBookings } = await import(
  '../userController.js'
);
const { default: User } = await import('../../models/User.js');
const { default: Booking } = await import('../../models/Booking.js');
const { sendOtp } = await import('../../services/otpService.js');

// ── Helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ── Test setup ─────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// register()
// ═══════════════════════════════════════════════════════════════════════════

describe('register()', () => {
  test('valid input: calls sendOtp and returns 202', async () => {
    // No existing user
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({});
    sendOtp.mockResolvedValue(undefined);

    const req = {
      body: { name: 'Alice', email: 'alice@example.com', password: 'secret123' },
    };
    const res = mockRes();

    await register(req, res);

    expect(sendOtp).toHaveBeenCalledWith('alice@example.com', 'registration', 'Alice');
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('OTP') })
    );
  });

  test('duplicate verified email: returns 409 "Email already registered"', async () => {
    // Existing verified user
    User.findOne.mockResolvedValue({ isVerified: true, _id: 'existing-id' });

    const req = {
      body: { name: 'Alice', email: 'alice@example.com', password: 'secret123' },
    };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email already registered' });
    expect(sendOtp).not.toHaveBeenCalled();
  });

  test('unverified existing account: deletes old account and re-registers', async () => {
    const existingUser = { isVerified: false, _id: 'old-id' };
    User.findOne.mockResolvedValue(existingUser);
    User.deleteOne.mockResolvedValue({});
    User.create.mockResolvedValue({});
    sendOtp.mockResolvedValue(undefined);

    const req = {
      body: { name: 'Alice', email: 'alice@example.com', password: 'secret123' },
    };
    const res = mockRes();

    await register(req, res);

    expect(User.deleteOne).toHaveBeenCalledWith({ _id: 'old-id' });
    expect(User.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
  });

  test('missing required fields: returns 400', async () => {
    const req = { body: { email: 'alice@example.com' } }; // missing name and password
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('password too short: returns 400', async () => {
    const req = { body: { name: 'Alice', email: 'alice@example.com', password: '123' } };
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('6') })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// loginPassword()
// ═══════════════════════════════════════════════════════════════════════════

describe('loginPassword()', () => {
  let bcryptCompareSpy;
  
  beforeEach(async () => {
    const bcrypt = await import('bcryptjs');
    bcryptCompareSpy = jest.spyOn(bcrypt.default || bcrypt, 'compare');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('valid credentials: returns token pair with accessToken, refreshToken, and user', async () => {
    const mockUser = {
      _id: 'user-id-1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
      password: 'hashedpassword',
    };
    User.findOne.mockResolvedValue(mockUser);
    bcryptCompareSpy.mockResolvedValue(true);

    const req = { body: { email: 'alice@example.com', password: 'secret123' } };
    const res = mockRes();

    await loginPassword(req, res);

    expect(res.status).not.toHaveBeenCalled(); // 200 is default (no status call)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          email: 'alice@example.com',
          role: 'user',
        }),
      })
    );
  });

  test('wrong password: returns 400 "Invalid credentials"', async () => {
    const mockUser = {
      _id: 'user-id-1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
      password: 'hashedpassword',
    };
    User.findOne.mockResolvedValue(mockUser);
    bcryptCompareSpy.mockResolvedValue(false);

    const req = { body: { email: 'alice@example.com', password: 'wrongpassword' } };
    const res = mockRes();

    await loginPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
  });

  test('unknown email: returns 400 "Invalid credentials" (no enumeration)', async () => {
    // User not found — same message as wrong password to prevent enumeration
    User.findOne.mockResolvedValue(null);

    const req = { body: { email: 'nobody@example.com', password: 'anypassword' } };
    const res = mockRes();

    await loginPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
  });

  test('missing fields: returns 400', async () => {
    const req = { body: { email: 'alice@example.com' } }; // missing password
    const res = mockRes();

    await loginPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// sendLoginOtp()
// ═══════════════════════════════════════════════════════════════════════════

describe('sendLoginOtp()', () => {
  test('unregistered email: returns 404 "No account found with this email"', async () => {
    User.findOne.mockResolvedValue(null);

    const req = { body: { email: 'ghost@example.com' } };
    const res = mockRes();

    await sendLoginOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'No account found with this email' });
    expect(sendOtp).not.toHaveBeenCalled();
  });

  test('registered email: calls sendOtp and returns 202', async () => {
    const mockUser = {
      _id: 'user-id-1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
      isVerified: true,
    };
    User.findOne.mockResolvedValue(mockUser);
    sendOtp.mockResolvedValue(undefined);

    const req = { body: { email: 'alice@example.com' } };
    const res = mockRes();

    await sendLoginOtp(req, res);

    expect(sendOtp).toHaveBeenCalledWith('alice@example.com', 'login', 'Alice');
    expect(res.status).toHaveBeenCalledWith(202);
  });

  test('missing email: returns 400', async () => {
    const req = { body: {} };
    const res = mockRes();

    await sendLoginOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// me()
// ═══════════════════════════════════════════════════════════════════════════

describe('me()', () => {
  test('valid token: returns correct profile (id, name, email, role)', async () => {
    const mockUser = {
      _id: 'user-id-1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
      select: jest.fn().mockReturnThis(), // chained .select('-password')
    };
    // findById returns a chainable with .select()
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const req = { user: { id: 'user-id-1', email: 'alice@example.com', role: 'user' } };
    const res = mockRes();

    await me(req, res);

    expect(User.findById).toHaveBeenCalledWith('user-id-1');
    expect(res.json).toHaveBeenCalledWith({
      id: 'user-id-1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
    });
  });

  test('user not found: returns 404', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const req = { user: { id: 'nonexistent-id', email: 'ghost@example.com', role: 'user' } };
    const res = mockRes();

    await me(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// myBookings()
// ═══════════════════════════════════════════════════════════════════════════

describe('myBookings()', () => {
  test('returns bookings sorted by preferredDate descending', async () => {
    const bookingsArray = [
      { _id: 'b1', email: 'alice@example.com', preferredDate: new Date('2025-12-01') },
      { _id: 'b2', email: 'alice@example.com', preferredDate: new Date('2025-06-15') },
      { _id: 'b3', email: 'alice@example.com', preferredDate: new Date('2025-03-10') },
    ];

    Booking.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(bookingsArray),
      }),
    });

    const req = { user: { id: 'user-id-1', email: 'alice@example.com', role: 'user' } };
    const res = mockRes();

    await myBookings(req, res);

    // Verify Booking.find was called with the user's email
    expect(Booking.find).toHaveBeenCalledWith({ email: 'alice@example.com' });

    // Verify sort was called with descending preferredDate
    const sortMock = Booking.find.mock.results[0].value.sort;
    expect(sortMock).toHaveBeenCalledWith({ preferredDate: -1 });

    // Verify the response contains the bookings
    expect(res.json).toHaveBeenCalledWith(bookingsArray);
  });

  test('returns empty array when user has no bookings', async () => {
    Booking.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const req = { user: { id: 'user-id-2', email: 'newuser@example.com', role: 'user' } };
    const res = mockRes();

    await myBookings(req, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('only fetches bookings for the authenticated user email', async () => {
    Booking.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const req = { user: { id: 'user-id-3', email: 'bob@example.com', role: 'user' } };
    const res = mockRes();

    await myBookings(req, res);

    // Must filter by the authenticated user's email — not any other email
    expect(Booking.find).toHaveBeenCalledWith({ email: 'bob@example.com' });
    expect(Booking.find).not.toHaveBeenCalledWith({ email: 'alice@example.com' });
  });
});
