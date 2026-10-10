# Personal AI chatbot setup

This feature adds a Windows XP desktop app named **Talk to Coy** and a backend endpoint at `POST /personal-ai/chat`.

## Required server environment variables

Configure these on the existing Render backend service (never in React or a public GitHub file):

- `OPENAI_API_KEY`: API key for the OpenAI project that owns the archive.
- `PERSONAL_AI_VECTOR_STORE_ID`: ID of the vector store containing the prepared personal archive.
- Optional `PERSONAL_AI_MODEL`: model ID to use; defaults to `gpt-5.5`.

The chatbot returns a setup message until both required variables are configured.

## Prepare the archive

1. Keep the original Discord export private. Do not commit it to this repository.
2. Remove other people's messages, private details, credentials, and anything you do not want a public visitor to be able to ask about.
3. Prefer your own public/server messages and selected conversations where you have permission to use the context. Do not upload private DMs wholesale.
4. Prepare a readable text or Markdown archive with dates and channel/context labels when useful. Include a separate, manually written personality and worldview document in your own words.
5. In the OpenAI platform, create a vector store and upload the prepared files. Copy its ID into `PERSONAL_AI_VECTOR_STORE_ID`.

## Frontend

The app uses `REACT_APP_API_BASE` when provided, otherwise it calls the existing Render backend at `https://winxp-7yes.onrender.com`. Do not put API secrets in frontend environment variables.

## Privacy and deployment

- Archive data is not committed to this repository by this feature.
- The endpoint sends the user's message and short recent conversation history to the model with `store: false`; service-provider operational/abuse-monitoring retention is governed by that provider's policy.
- The route has a small in-memory per-IP request limiter. Add stronger abuse protection and a budget alert before promoting the chatbot widely.
- The UI identifies the bot as an AI representation, not the actual person.
- Review the archive and access policy before making it publicly available.
