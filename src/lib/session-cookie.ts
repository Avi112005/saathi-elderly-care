/**
 * Session cookie name. In production the `__Host-` prefix makes the browser enforce
 * Secure, Path=/ and no Domain attribute, so a subdomain can never plant or read it.
 * (Plain HTTP on localhost can't use the prefix, so development uses the bare name.)
 */
export function sessionCookieName(env: string | undefined = process.env.NODE_ENV): string {
  return env === "production" ? "__Host-saathi_session" : "saathi_session";
}
