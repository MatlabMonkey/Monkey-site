# Todo v2 mobile and Shortcut capture

`POST /api/tasks/capture` is the narrow mobile capture boundary for todo v2. It accepts JSON with a task title and a stable capture identifier, authenticates with the server's capture bearer key, and always creates the task in Inbox with `source=shortcut`.

```json
{
  "title": "Call the dentist",
  "capture_id": "8E744D54-2E09-47A1-B793-28A8D2C4D357"
}
```

The route accepts `content`, `text`, or `task` as title aliases. The capture ID should be generated once per Shortcut run and retained for automatic HTTP retries. A new capture returns `201`; an exact replay returns the same task with `200` and `replayed=true`, even if that task was organized after capture; reuse with different original content returns `409`. Replay comparison uses the immutable captured event rather than mutable current task fields. The endpoint never accepts a requested task state, so mobile capture cannot bypass Inbox review.

## Apple Shortcut

Use `scripts/apple-shortcut-config.json` as the field map:

1. Accept dictated text, prompted text, clipboard text, or share-sheet text.
2. Generate a UUID.
3. Use **Get Contents of URL** with `POST`, JSON request body, and the private bearer header.
4. Send the input as `title` and the generated UUID as `capture_id`.
5. Show a short success notification only for HTTP `200` or `201`; expose the server error for other responses.

Keep the bearer value private in the user's Shortcut and server environment. Do not place it in this repository or screenshots.

## Verification

The deterministic contract is covered by `npm run test:todo-v2`. Once migrations 028-031 are available in a disposable or preview database and this branch is deployed there, run:

```sh
TODO_CAPTURE_BASE_URL=https://preview.example \
TODO_CAPTURE_TOKEN='private-value' \
npm run test:todo-v2-shortcut -- "Shortcut preview check"
```

The smoke script creates one Inbox task, retries it to prove exact replay, and submits changed content with the same ID to prove conflict rejection. Final acceptance still requires one request from the installed Shortcut on the mobile device and confirmation that its created task appears in the v2 Inbox. Do not run the smoke script against production unless creating that verification task is explicitly approved.
