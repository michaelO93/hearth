# Friction log

## 1. Amazon Bedrock: account cannot invoke any model

**Severity:** Critical (blocked the primary AI path)

**Task attempted:** Run Hearth's household agent on Claude Haiku 4.5 through the Bedrock Converse API with tool use.

**Steps taken**
1. Created IAM user `hearth-hackathon`, configured a CLI profile, and confirmed it with `aws sts get-caller-identity`.
2. Requested model access in the Bedrock console. Access was not approved.
3. Called Converse from the AWS CLI:
   ```bash
   aws bedrock-runtime converse --region us-east-1 \
     --model-id us.anthropic.claude-haiku-4-5-20251001-v1:0 \
     --messages '[{"role":"user","content":[{"text":"hi"}]}]'
   ```
4. Tried Amazon's own `us.amazon.nova-lite-v1:0` (us-east-1) and `us.amazon.nova-micro-v1:0` (us-west-2) to rule out a model-specific approval.

**Expected:** A reply from at least one model, especially Amazon Nova, which does not need a third-party model agreement.

**Actual:** Every model, in both regions, returned:
```
ValidationException: Error 002: Access to Bedrock models is not allowed for this account
```
With the same credentials, Amazon Polly worked on the first try.

**Problems with the experience**
- It's a `ValidationException`, so it looks like a bad request, not a permissions or account problem. Code that classifies errors by type (ours did at first) treats it as retryable.
- The message gives no reason (new account? billing verification? region? Nigeria-based account?) and no link to a fix.
- Nothing in the console said the account was restricted before the first call.

**Workaround:** Put Bedrock first in a fallback chain (Bedrock → xAI → local intent), treated "not allowed for this account" as a permanent failure, and cached it so later turns skip Bedrock with no latency. The integration code is in `src/lib/hearth/aws.ts` and is ready to run on an account with access.

**Suggestions**
1. Return `AccessDeniedException` with a reason code (e.g. `ACCOUNT_NOT_VERIFIED`) instead of `ValidationException`.
2. Link the error to a doc page listing the conditions behind "Error 002" and how to clear them.
3. Show the account-level restriction as a banner on the Bedrock console's Model access page.
4. For hackathons, offer a sponsor fast path (promo credits plus pre-cleared access) for registered participants.
