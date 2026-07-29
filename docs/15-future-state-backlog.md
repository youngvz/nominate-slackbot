# Future-State Backlog

Items in this file are not part of Phase 1 unless explicitly promoted through a documented scope change.

## Nomination invalidation

### Approved future behavior

Authorized maintainers may invalidate a nomination when it was accidental, assigned to the wrong recipient, technically duplicated, inappropriate, or otherwise ineligible.

Invalidation must:

- Preserve the original nomination for audit purposes.
- Exclude it from report scoring.
- Exclude its description from winner DMs.
- Record who invalidated it, when, and why.
- Restore the nominator's eligibility for the same recipient immediately.

### DynamoDB transaction

The future operation should atomically:

1. Change nomination status to `INVALIDATED`.
2. Add invalidation metadata.
3. Delete or supersede the active eligibility item for the pair.
4. Add an append-only audit event.

The entire operation must succeed or fail as one transaction. Repeated requests must be idempotent.

### Future fields

```ts
type NominationStatus = "ACTIVE" | "INVALIDATED";

interface InvalidationMetadata {
  invalidatedAt: string;
  invalidatedBySlackId: string;
  invalidationReason: string;
}
```

### Future interface options

- Maintainer-only Slack command.
- Slack App Home administration surface.
- Message action from a maintainer nomination list.
- Authenticated administration portal.

The interface may change without changing the approved domain behavior.

## Inappropriate-language blocklist

Consider a future validation layer that detects configured terms before storage.

Requirements should include:

- Configurable term list.
- Case and basic character normalization.
- Neutral prompt asking the nominator to revise.
- No storage or logging of the rejected full description.
- Metrics for rejection count without sensitive content.
- Human review and invalidation remain available because filters are imperfect.

## Maintainer administration

Potential capabilities:

- View nomination metadata.
- Trace a description to a nominator for misconduct review.
- Invalidate and restore nominations.
- Retry failed winner DMs.
- Change channel, schedule, and timezone.
- Review report execution history.

## Additional Slack entry points

- Message shortcut that pre-populates context from a Slack message.
- App Home nomination entry point.
- Optional administrative slash command.

## Multi-workspace distribution

Future work for broader installation:

- Full OAuth installation lifecycle.
- Per-workspace encrypted token storage.
- Installation revocation and cleanup.
- Tenant-level configuration.
- Slack Marketplace review and documentation.
- Billing or support model if applicable.

## Enhanced reporting

Possible additions:

- Department summaries.
- Participation trends.
- Historical dashboards.
- Exportable aggregate reports.
- Configurable report copy.

Do not introduce weighted scoring without a separate product decision.
