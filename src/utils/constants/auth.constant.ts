/**
 * The name of the HTTP-only cookie that carries the access token.
 */
export const ACCESS_TOKEN_COOKIE_NAME = 'access_token'

/**
 * A pre-computed bcrypt hash of a fixed random string.
 * Used exclusively in login flows to perform a timing-safe comparison
 * even when no user is found — preventing user-enumeration via timing attacks.
 * Never compare real passwords against this hash in a success path.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$10$I2x.212J3vdKtXQdCh/b/OQk7oVt7LaTUDXVTid9nG.zZRmv1Sdwy'
