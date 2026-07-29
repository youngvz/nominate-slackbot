import { describe, it } from "vitest";

// Release-blocking test called out in docs/12-testing-strategy.md
// §Required concurrency test. Two or more simultaneous submissions for the same
// workspace/nominator/recipient must resolve with exactly one acceptance.
describe.skip("nomination concurrency (integration)", () => {
  it("exactly one of N concurrent transactions is ACCEPTED, the rest are REJECTED_REPEAT_WINDOW", () => {
    // TODO: run against dynamodb-local or an AWS test account per docs/13
    //       §Local DynamoDB.
  });
});
