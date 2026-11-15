import { AuthorizationError } from "./session";
import { fail, type ActionState } from "@/lib/actions";

/**
 * Runs a server-action body and turns permission failures into a friendly form error.
 * Anything else (including Next.js redirects, which are thrown) propagates unchanged,
 * so unexpected failures still reach the error boundary and logs.
 */
export async function guarded(body: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await body();
  } catch (err) {
    if (err instanceof AuthorizationError) return fail(err.message);
    throw err;
  }
}
