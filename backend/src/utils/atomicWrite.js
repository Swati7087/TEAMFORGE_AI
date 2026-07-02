import mongoose from "mongoose";

/**
 * Runs the provided write batch inside a Mongoose transaction. If the
 * underlying MongoDB deployment doesn't support transactions (bare
 * standalone `mongod`, older Atlas shared tier, etc.), silently falls back
 * to executing the same writes without a session — matching the pre-
 * transaction behaviour exactly.
 *
 * IMPORTANT: `writes` MUST be idempotent. Mongoose's `withTransaction` may
 * retry the callback on transient commit errors (and on the "unsupported"
 * failure path we invoke it a second time without a session). Guard any
 * `push`/`addToSet` style mutations against re-application on retry.
 *
 * @param {(session: import("mongoose").ClientSession | null) => Promise<void>} writes
 *   Callback that performs the writes. Pass `session` through to each
 *   `.save({ session })` / `.updateOne({...}, { session })` call.
 * @returns {Promise<{ transactional: boolean }>}
 */
export async function saveAtomically(writes) {
  const session = await mongoose.startSession();
  try {
    try {
      await session.withTransaction(async () => {
        await writes(session);
      });
      return { transactional: true };
    } catch (err) {
      if (!isTransactionUnsupported(err)) throw err;
      // Fall through to the sequential path below.
    }
  } finally {
    await session.endSession();
  }

  // Sequential fallback — no atomicity, same behaviour as before this helper
  // existed. Safe because `writes` is documented as idempotent.
  await writes(null);
  return { transactional: false };
}

// MongoDB tells us in a few different ways that transactions aren't going to
// happen on this deployment. Retryable writes are used implicitly by
// `withTransaction`, so a standalone `mongod` refusing them counts here too.
function isTransactionUnsupported(err) {
  if (!err) return false;
  const msg = String(err.message || err.errmsg || "");
  const codeName = err.codeName;
  const code = err.code;

  const match =
    codeName === "IllegalOperation" ||
    code === 20 ||
    code === 8000 || // Atlas shared-tier historical "no transactions" code
    /Transaction numbers are only allowed on a replica set/i.test(msg) ||
    /Transactions are not supported/i.test(msg) ||
    /does not support transactions/i.test(msg) ||
    /does not support retryable writes/i.test(msg) ||
    /requires (a )?replica set/i.test(msg);

  // One-line debug hint so if a new MongoDB deployment quirk shows up we
  // don't have to grep the driver source to figure out the shape.
  if (!match && process.env.NODE_ENV !== "production") {
    console.warn(
      `[saveAtomically] non-fallback error — code=${code} codeName=${codeName} msg="${msg.slice(0, 120)}"`
    );
  }

  return match;
}
