/// Agent Black Box
///
/// Every decision an AI agent makes is recorded here, in the SAME transaction
/// as the payment it triggers. The full reasoning trace lives on Walrus; this
/// module commits the Walrus blob id and the SHA-256 of the trace on-chain.
///
/// The record is frozen (immutable) so nobody can rewrite history later.
module black_box::black_box;

use std::string::String;
use sui::clock::Clock;
use sui::event;

const EEmptyBlobId: u64 = 0;
const EBadHashLength: u64 = 1;

/// Immutable on-chain receipt for one agent decision.
public struct DecisionLog has key, store {
    id: UID,
    agent: address,
    walrus_blob_id: String,
    log_hash: vector<u8>, // sha256 of the exact bytes stored on Walrus
    action: String,       // "transfer" | "blocked" | "no_action"
    recipient: address,
    amount_mist: u64,
    risk_flagged: bool,
    timestamp_ms: u64,
}

/// Emitted for every record so indexers and the dashboard can follow along.
public struct DecisionRecorded has copy, drop {
    log_id: ID,
    agent: address,
    walrus_blob_id: String,
    log_hash: vector<u8>,
    action: String,
    recipient: address,
    amount_mist: u64,
    risk_flagged: bool,
    timestamp_ms: u64,
}

/// Call this inside the same programmable transaction block that moves funds
/// (or instead of moving funds, when the agent's action was blocked).
public fun record_decision(
    walrus_blob_id: String,
    log_hash: vector<u8>,
    action: String,
    recipient: address,
    amount_mist: u64,
    risk_flagged: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(walrus_blob_id.length() > 0, EEmptyBlobId);
    assert!(log_hash.length() == 32, EBadHashLength);

    let timestamp_ms = clock.timestamp_ms();
    let log = DecisionLog {
        id: object::new(ctx),
        agent: ctx.sender(),
        walrus_blob_id,
        log_hash,
        action,
        recipient,
        amount_mist,
        risk_flagged,
        timestamp_ms,
    };

    event::emit(DecisionRecorded {
        log_id: object::id(&log),
        agent: log.agent,
        walrus_blob_id: log.walrus_blob_id,
        log_hash: log.log_hash,
        action: log.action,
        recipient: log.recipient,
        amount_mist: log.amount_mist,
        risk_flagged: log.risk_flagged,
        timestamp_ms: log.timestamp_ms,
    });

    transfer::freeze_object(log);
}
