# Syncfy support ticket — BBVA México credentials never sync (draft)

**To:** Syncfy / Paybook support
**From:** FinovAI (account for API key on production environment)
**Subject:** BBVA México site 56cf5728784806f72b8b456b: credentials fail 100% of syncs since 10 June with 400 "Credential can't be sync at this moment"

## Summary

Every credential our users have created for BBVA México (site `56cf5728784806f72b8b456b`) has failed every synchronization attempt since 10 June 2026. No credential for this site has ever completed a single successful sync. Other sites on the same API key (notably American Express) sync correctly, so this appears specific to the BBVA connector or to a requirement our widget flow is not surfacing (e.g. an additional 2FA/token step).

## Evidence

- 376 failed attempts across 3 credentials between 10 June and 30 August 2026.
- Identical response on every attempt:
  `{"code":400,"status":false,"message":"Credential can't be sync at this moment"}`
- Most recent request IDs (RIDs):
  - `ec7c682b-c595-4851-964c-5bf58d0b75a9`
  - `773390ec-67c5-4457-b8cf-f10b22a80a8c`
- Webhooks: no `credentials.*` webhook has been delivered for any of these credentials since 26 June 2026, while API polling continued to return the 400 above.
- Credentials were created through the standard Syncfy widget; users report entering valid online-banking credentials.

## Questions

1. Is the BBVA México connector degraded or under maintenance since ~10 June? If so, what is the expected resolution?
2. Does this site require an interactive 2FA/token step that must be completed through the widget on every sync? If so, which credential status / webhook sequence should we expect and handle?
3. Why did webhook delivery for these credentials stop on 26 June while the credentials still exist and poll?
4. Can you confirm from the RIDs above what the institution-side error actually is?

## Impact

BBVA México is the largest retail bank in our target market; all our BBVA users have zero transactions. We have paused offering BBVA in our institution picker until this is resolved.
