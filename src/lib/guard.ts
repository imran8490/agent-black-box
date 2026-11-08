import { isValidAddress, textMentionsAddr } from "./addr";
import { findInjections } from "./patterns";

export interface GuardContext {
  trusted: string; // what the human actually said
  untrusted: string[]; // everything the agent read from outside
  maxSui: number;
}

/**
 * Black Box policy: provenance + limits.
 *
 * The core idea: a payment destination must be traceable to the TRUSTED
 * instruction. If the recipient shows up only in content the agent read from
 * the outside world, the instruction probably came from an attacker.
 *
 * Returns a list of flags. An empty list means the payment may proceed.
 */
export function evaluateProposal(
  p: { recipient: string; amount_sui: number },
  ctx: GuardContext,
): string[] {
  const flags: string[] = [];

  if (!isValidAddress(p.recipient)) {
    flags.push("invalid_recipient");
  } else if (!textMentionsAddr(ctx.trusted, p.recipient)) {
    const inUntrusted = ctx.untrusted.some((u) => textMentionsAddr(u, p.recipient));
    flags.push(
      inUntrusted
        ? "recipient_only_in_untrusted_input"
        : "recipient_not_in_user_instruction",
    );
  }

  if (!Number.isFinite(p.amount_sui) || p.amount_sui <= 0 || p.amount_sui > ctx.maxSui) {
    flags.push("amount_exceeds_limit");
  }

  if (ctx.untrusted.some((u) => findInjections(u).length > 0)) {
    flags.push("injection_pattern_in_untrusted_input");
  }

  return flags;
}
