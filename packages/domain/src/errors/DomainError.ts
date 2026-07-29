export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class SelfNominationError extends DomainError {
  readonly code = "SELF_NOMINATION";
}

export class IneligibleRecipientError extends DomainError {
  readonly code = "INELIGIBLE_RECIPIENT";
  constructor(readonly reason: "GUEST" | "EXTERNAL" | "BOT" | "DEACTIVATED" | "OTHER_WORKSPACE") {
    super(`Recipient ineligible: ${reason}`);
  }
}

export class DuplicateWithinWindowError extends DomainError {
  readonly code = "DUPLICATE_WITHIN_WINDOW";
  constructor(readonly nextEligibleAt: string) {
    super(`Nomination pair still restricted until ${nextEligibleAt}`);
  }
}

export class DescriptionInvalidError extends DomainError {
  readonly code = "DESCRIPTION_INVALID";
  constructor(readonly reason: "REQUIRED" | "TOO_SHORT" | "TOO_LONG") {
    super(`Description invalid: ${reason}`);
  }
}
