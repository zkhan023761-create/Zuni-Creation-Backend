/**
 * Unit tests for token-related handlers in userController.js
 *
 * Validates: Requirements 4.4, 4.5
 *
 * Covers:
 *   - refresh(): valid token → new access token
 *   - refresh(): missing token → 401
 *   - refresh(): invalid/malformed token → 401
 *   - refresh(): admin role token → 401 (role check)
 *   - refresh(): user not found in DB → 401
 *   - me(): valid req.user → correct profile
 *   - me(): user not found in DB → 404
 *
 * Uses jest.unstable_mockModule for ESM-compatible mocking.
 * Real JWT tokens are created with jsonwebtoken — JWT is NOT mocked.
 */

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// ── Environment setup ──────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';

// ── Mock User model ────────────────────────────────────────────────────────
jest.unstable_mockModule('../../models/User.js', () => ({
  default: {
    findById: jest.fn(),
    findOne: jest.fn(),
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

// ── Mock otpService (imported by userController) ───────────────────────────
jest.unstable_mockModule('../../services/otpService.js', () => ({
  sendOtp: jest.fn(),
  validateOtp: jest.fn(),
}));

// ── Dynamic imports AFTER mocks are registered ────────────────────────────
const { refresh, me } = await import('../userController.js');
const { default: User } = await import('../../models/User.js');

// ── Helpers ────────────────────────────────────────────────────────────────
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

/** Create a real refresh token signed with the test secret */
function makeRefreshToken(userId) {
  return jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

/** Create a real access token signed with the test secret */
function makeAccessToken(userId, email, role) {
  return jwt.sign({ id: userId, email, role }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

// ── Test setup ─────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// refresh()
// ═══════════════════════════════════════════════════════════════════════════

describe('refresh()', () => {
  test('valid refresh token for a user (role: user) → returns { accessToken: <string> }', async () => {
    const userId = 'user-id-abc';
    const mockUser = {
      _id: userId,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
    };

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    const refreshToken = makeRefreshToken(userId);
    const req = { body: { refreshToken } };
    const res = mockRes();

    await refresh(req, res);

    expect(res.status).not.toHaveBeenCalled(); // 200 is default
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: expect.any(String) })
    );

    // Verify the returned access token is valid and contains correct claims
    const { accessToken } = res.json.mock.calls[0][0];
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    expect(decoded.id).toBe(userId);
    expect(decoded.email).toBe('alice@example.com');
    expect(decoded.role).toBe('user');
  });

  test('no refresh token in body → 401', async () => {
    const req = { body: {} };
    const res = mockRes();

    await refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('invalid/malformed token → 401', async () => {
    const req = { body: { refreshToken: 'this.is.not.a.valid.jwt' } };
    const res = mockRes();

    await refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('valid refresh token but user has role "admin" → 401 (role check)', async () => {
    const userId = 'admin-id-xyz';
    const mockAdmin = {
      _id: userId,
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin', // admin role — should be rejected
    };

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockAdmin),
    });

    const refreshToken = makeRefreshToken(userId);
    const req = { body: { refreshToken } };
    const res = mockRes();

    await refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });

  test('valid refresh token but user not found in DB → 401', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const refreshToken = makeRefreshToken('nonexistent-user-id');
    const req = { body: { refreshToken } };
    const res = mockRes();

    await refresh(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// me()
// ═══════════════════════════════════════════════════════════════════════════

describe('me()', () => {
  test('valid req.user → returns correct profile (id, name, email, role)', async () => {
    const mockUser = {
      _id: 'user-id-1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'user',
    };

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

  test('user not found in DB → 404', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const req = { user: { id: 'ghost-id', email: 'ghost@example.com', role: 'user' } };
    const res = mockRes();

    await me(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });
});
