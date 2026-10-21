# Teacher-owned Groq keys

## Teacher workflow

1. Sign in as a teacher and open **AI settings** in the sidebar, even before creating a classroom.
2. Create a key in the [Groq console](https://console.groq.com/keys) and paste only the key into the password field.
3. Save. The input is cleared and only saved/not-saved metadata is returned. Saving makes no provider request and does not verify quota or model access.
4. Generate curriculum, lessons, assessments, or curriculum slides normally. The app uses this account's key across its owned classrooms.
5. Replace or remove the key from the same settings page. Removing it stops new generation requests but does not revoke it at Groq. An already-running request may finish.

Students never need keys. Existing content, manual authoring, publication, and student access remain usable without AI credentials. Missing or invalid credentials fail cleanly without changing published content. Generation errors can require replacing the key or checking the teacher's Groq allowance.

## Deployment requirement

Add `AI_CREDENTIAL_ENCRYPTION_KEY` to the server environment. Generate a new 32-byte hexadecimal value:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The value must be exactly 64 hexadecimal characters. Use a separate value from `BETTER_AUTH_SECRET`. Keep it stable and backed up securely. Do not commit it, share it with teachers, or expose it through a `NEXT_PUBLIC_` variable. If it is lost or rotated, teachers must re-enter their keys. If it is missing, saving and decrypting keys are disabled; manual classroom use remains available.

Apply the committed `teacher_ai_settings` migration and generate Prisma Client. The configured Vercel deployment build does both automatically. A shared `GROQ_API_KEY` is no longer required for active generation.

## Security and routing

- A separate `TeacherAISettings` table prevents credentials from becoming authentication/session fields. Rows belong to a teacher ID and cascade on account deletion.
- AES-256-GCM encrypts each key using a random 12-byte nonce and a 16-byte authentication tag. Authenticated context binds ciphertext to its teacher and provider.
- Authenticated settings endpoints use the current actor only. Student access is rejected; write requests require the configured same origin and bounded, schema-validated bodies.
- Reads and writes return only configuration status, storage readiness, and timestamps. Plaintext and ciphertext are never returned to the browser or put in job metadata, logs, cookies, or application local storage.
- Job creation and execution resolve the creator's key on the server. Existing classroom ownership checks remain in place. There is no shared-key or cross-provider fallback.
- Teacher keys are sent only to the official Groq API endpoint. Teacher generation ignores environment overrides of the Groq API base URL.
- Models and token limits remain centrally configurable. `GROQ_REASONING_MODEL` and `GROQ_FAST_MODEL` select models, with a centralized Groq model default when omitted.

Encryption protects database contents without the server encryption secret; it is not end-to-end encryption. The application server must decrypt credentials to call Groq. Production deployment must use HTTPS.

## Manual verification

Functional verification remains with the owner. No automated tests, browser checks, or live AI smoke calls are part of this implementation workflow.

- Confirm students cannot open the settings page or use its API.
- Save a key for teacher A; confirm teacher B sees no saved key and cannot generate using A's key.
- Confirm the key is absent from responses and subsequent page HTML; refresh and check only its saved status is displayed.
- Replace/remove a key and check the setup notice updates. Existing content should remain unchanged.
- With the server encryption secret missing or changed, verify clear errors and continued manual access.
- When you choose to spend provider quota, generate one item in each workflow and check missing, revoked, and rate-limited key handling.

References: [Groq security guidance](https://console.groq.com/docs/production-readiness/security-onboarding), [Node.js crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html).
