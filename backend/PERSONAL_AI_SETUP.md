# Coy chatbot setup

This feature adds the Windows XP desktop app named **Coy** and a backend endpoint at `POST /personal-ai/chat`.

## Server environment variables

Configure provider keys on the existing Render backend service (never in React or a public GitHub file). At least one AI provider key is required:

- `GROQ_API_KEY`: optional; tried first. Create a key at https://console.groq.com/keys.
- `OPENROUTER_API_KEY`: optional; tried after Groq. Create a key at https://openrouter.ai/keys. The default model is `openrouter/free`.
- `OPENROUTER_API_KEY_2`: optional second OpenRouter account key; tried as an additional fallback after `OPENROUTER_API_KEY`. Set it only in Render Environment, never in frontend code or GitHub.
- `GEMINI_API_KEY`: optional fallback, tried after Groq and OpenRouter. Create a key in Google AI Studio.
- `GROQ_MODEL`: optional model override. Defaults to `openai/gpt-oss-120b` for text and `qwen/qwen3.8-27b` for image messages.
- `OPENROUTER_MODEL`: optional model override. Defaults to `openrouter/free`.
- `GEMINI_MODEL`: optional Gemini model override; defaults to `gemini-3.8-flash`.
- `COHERE_API_KEY`: optional text-only fallback key.
- `COHERE_API_KEY_2`: optional second Cohere account key; tried after `COHERE_API_KEY`. Both Cohere entries support text-only requests in this integration; image/audio requests skip them.
- `GEMINI_FILE_SEARCH_STORE_NAME`: optional Gemini File Search store name for prepared, privacy-reviewed archive files. This feature only runs on Gemini requests.
- `PERSONAL_AI_BIRTH_DATE`: optional private date in `YYYY-MM-DD` format. The server calculates the current age per request and only supplies the age to the model; never commit the date to source control or expose it in frontend variables.

## Automatic provider failover

Coy tries configured providers in this order: Groq, OpenRouter, `OPENROUTER_API_KEY_2`, Gemini, OpenAI, xAI, Cohere, then `COHERE_API_KEY_2`. If a provider returns an error, is rate-limited, times out, or returns an empty response, Coy automatically tries the next configured provider. Missing provider keys are skipped. The endpoint health response lists configured provider names but never exposes keys.

Coy's private GitHub memory is loaded independently of the AI provider, so switching models does not move or erase that memory. Each provider receives the same composed personality, approved memory index, relevant Discord-style excerpts, and recent chat history. Gemini-only tools (Google Search, URL context, and Gemini File Search) are available only when Gemini is the provider that successfully answers.

Image uploads are sent to Groq/OpenRouter using OpenAI-compatible image input when possible; provider/model compatibility can vary. Audio uploads are routed past Groq and OpenRouter to Gemini because their audio request formats are not interchangeable. If Gemini is rate-limited too, the request can still fail until a provider becomes available.

Chat works when at least one provider key is configured.

## Language support

The chatbot follows the user's language:

- Korean input gets a natural Korean reply.
- English input gets an English reply.
- Chinese input gets a mostly English reply with some natural Chinese mixed in.
- Any other language gets an English reply.
- Korean-English mixed messages can receive a natural mix. Coy should not ask the user to choose a language or say "or in English if you prefer."
- Coy's personality, approved memories, and privacy safeguards stay consistent across languages.

This is enforced in the server-side model instructions, not just the interface.

## Prepare the archive

1. Keep the original Discord export private. Do not commit it to this repository.
2. The supplied exports are overwhelmingly direct and group DMs. Do not upload them wholesale. Use them to derive only a high-level writing-style guide, and exclude secrets, sensitive details, private conversation content, and other people's personal information.
3. For memory retrieval, add only facts and stories you explicitly approve for a public-facing bot. Prefer a separate manually written personality/worldview document and a small, privacy-reviewed set of non-sensitive examples.
4. In Google AI Studio, create a Gemini File Search store and upload only those prepared files. Set its store name in `GEMINI_FILE_SEARCH_STORE_NAME`. Files in the previous store need to be migrated separately.

## Frontend

The app uses `REACT_APP_API_BASE` when provided, otherwise it calls the existing Render backend at `https://bloxify-backend-sg.onrender.com`. Do not put API secrets in frontend environment variables.

## Privacy and deployment

- Archive data is not committed to this repository by this feature.
- The endpoint sends the user's message and short recent conversation history to Gemini; Google's data handling and retention depend on the applicable API tier and terms.
- The route has a small in-memory per-IP request limiter. Add stronger abuse protection and a budget alert before promoting the chatbot widely.
- `PERSONAL_AI_BIRTH_DATE` is a server-only setting; the chatbot receives the computed age, not the exact date. The age changes automatically after each birthday. Do not expose the date in public UI or repository files.
- The UI presents Coy as a conversational companion, not the actual person.
- Review the archive and access policy before making it publicly available.


## Verify Discord-style learning is actually available

The backend reads `coy-discord-style-corpus.txt` and `coy-approved-memory.md` from the private `bagoffish/coy-private-memory` repository using `COY_MEMORY_GITHUB_TOKEN`, `COY_MEMORY_GITHUB_REPO`, `COY_MEMORY_GITHUB_PATH`, and `COY_MEMORY_GITHUB_FACTS_PATH`. A successful file fetch does not mean the corpus contains messages: an empty `coy-discord-style-corpus.txt` provides no examples to learn from. Check the backend memory status endpoint/logs and confirm the corpus file has privacy-reviewed, non-sensitive style examples before expecting stronger Discord-style matching. Do not commit a raw Discord export to a public repository or include private messages verbatim in the prompt. For broader retrieval, use only a private, access-controlled archive or a Gemini File Search store containing curated, privacy-reviewed material, and verify that retrieval is returning relevant excerpts.
