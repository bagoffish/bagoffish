# Personal AI chatbot setup

This feature adds a Windows XP desktop app named **Talk to Coy** and a backend endpoint at `POST /personal-ai/chat`.

## Required server environment variables

Configure these on the existing Render backend service (never in React or a public GitHub file):

- `OPENAI_API_KEY`: API key for the OpenAI project that owns the archive.
- `PERSONAL_AI_VECTOR_STORE_ID`: ID of the vector store containing the prepared, privacy-reviewed archive.
- `PERSONAL_AI_BIRTH_DATE`: optional private date in `YYYY-MM-DD` format. The server calculates the current age per request and only supplies the age to the model; never commit the date to source control or expose it in frontend variables.
- Optional `PERSONAL_AI_MODEL`: model ID to use; defaults to `gpt-5.5`.

The chatbot returns a setup message until both required variables are configured.

## Prepare the archive

1. Keep the original Discord export private. Do not commit it to this repository.
2. The supplied exports are overwhelmingly direct and group DMs. Do not upload them wholesale. Use them to derive only a high-level writing-style guide, and exclude secrets, sensitive details, private conversation content, and other people's personal information.
3. For memory retrieval, add only facts and stories you explicitly approve for a public-facing bot. Prefer a separate manually written personality/worldview document and a small, privacy-reviewed set of non-sensitive examples.
4. In the OpenAI platform, create a vector store and upload only those prepared files. Copy its ID into `PERSONAL_AI_VECTOR_STORE_ID`.

## Frontend

The app uses `REACT_APP_API_BASE` when provided, otherwise it calls the existing Render backend at `https://winxp-7yes.onrender.com`. Do not put API secrets in frontend environment variables.

## Privacy and deployment

- Archive data is not committed to this repository by this feature.
- The endpoint sends the user's message and short recent conversation history to the model with `store: false`; service-provider operational/abuse-monitoring retention is governed by that provider's policy.
- The route has a small in-memory per-IP request limiter. Add stronger abuse protection and a budget alert before promoting the chatbot widely.
- `PERSONAL_AI_BIRTH_DATE` is a server-only setting; the chatbot receives the computed age, not the exact date. The age changes automatically after each birthday. Do not expose the date in public UI or repository files.
- The UI identifies the bot as an AI representation, not the actual person.
- Review the archive and access policy before making it publicly available.
