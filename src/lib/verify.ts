import { isValidAddress, sameAddr } from "./addr";
import { sha256, toHex } from "./hash";
import { fetchRecordedEvent } from "./sui";
import { findEntryByDigest, readCachedLog } from "./store";
import { readBlob } from "./walrus";
import type { DecisionLog, OnchainRecord, VerifyResult } from "./types";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Independent verification of one decision, starting from a Sui tx digest only:
 *   1. read the DecisionRecorded event from the chain
 *   2. download the blob it points to from Walrus
 *   3. SHA-256 the downloaded bytes and compare with the hash committed on-chain
 *   4. cross-check the log's claims against what the chain says really happened
 * The local index is never trusted here.
 */
export async function verifyDigest(digest: string): Promise<VerifyResult> {
  const reasons: string[] = [];

  let onchain: OnchainRecord | null;
  try {
    onchain = await fetchRecordedEvent(digest.trim());
  } catch (e) {
    const reasons = [`Could not read this transaction from Sui: ${msg(e)}`];
    // Never call it verified, but do not leave the viewer with nothing: show the local copy if we have one.
    const entry = await findEntryByDigest(digest);
    const cached = entry ? await readCachedLog(entry.id) : null;
    if (cached) {
      reasons.push(
        "Showing the local copy of this log below. It is UNVERIFIED until Sui and Walrus are reachable.",
      );
    }
    return {
      digest,
      verdict: "pending",
      reasons,
      log: cached ?? undefined,
      log_source: cached ? "local-cache" : undefined,
    };
  }
  if (!onchain) {
    return {
      digest,
      verdict: "mismatch",
      reasons: ["This transaction contains no Black Box DecisionRecorded event, so there is nothing to verify."],
    };
  }

  let bytes: Uint8Array | null = null;
  try {
    bytes = await readBlob(onchain.walrus_blob_id);
  } catch (e) {
    reasons.push(`Walrus read failed: ${msg(e)}`);
  }

  if (!bytes) {
    // Fallback: show the local copy, but never call it verified.
    const entry = await findEntryByDigest(digest);
    const cached = entry ? await readCachedLog(entry.id) : null;
    if (cached) {
      reasons.push(
        "Showing a local cached copy. Integrity cannot be confirmed until Walrus is reachable.",
      );
    }
    return {
      digest,
      verdict: "pending",
      reasons,
      onchain,
      log: cached ?? undefined,
      log_source: cached ? "local-cache" : undefined,
    };
  }

  const computed = toHex(sha256(bytes));
  const hashMatches = computed === onchain.log_hash.toLowerCase();
  reasons.push(
    hashMatches
      ? "SHA-256 of the Walrus blob equals the hash committed on Sui."
      : "The Walrus blob does NOT match the hash committed on Sui. The log was altered or replaced.",
  );

  let log: DecisionLog | undefined;
  try {
    log = JSON.parse(new TextDecoder().decode(bytes)) as DecisionLog;
  } catch {
    reasons.push("The blob is not valid JSON.");
  }

  let consistent = true;
  if (log && hashMatches) {
    if (log.outcome !== onchain.action) {
      consistent = false;
      reasons.push(
        `The log says "${log.outcome}" but the chain recorded "${onchain.action}".`,
      );
    }
    if (
      log.proposal &&
      isValidAddress(log.proposal.recipient) &&
      onchain.action !== "no_action" &&
      !sameAddr(log.proposal.recipient, onchain.recipient)
    ) {
      consistent = false;
      reasons.push("The recipient in the log differs from the recipient recorded on-chain.");
    }
    if (consistent) {
      reasons.push("The log's outcome and recipient match what the chain recorded.");
    }
  }

  return {
    digest,
    verdict: hashMatches && consistent ? "verified" : "mismatch",
    reasons,
    onchain,
    computed_hash: computed,
    log,
    log_source: "walrus",
  };
}
