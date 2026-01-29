# Unsplash API Keys

From [Unsplash API Documentation](https://unsplash.com/documentation) your application has three values:

| Key | Use in this app | Where to put it |
|-----|-----------------|-----------------|
| **Access Key** | ✅ Yes – used for `/photos/random`, `/search/photos`, and download tracking | `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` in `.env.local` |
| **Secret Key** | ❌ No (unless you add server-side OAuth) | Do **not** use `NEXT_PUBLIC_*`. If needed: `UNSPLASH_SECRET_KEY` (server-only). |
| **Application ID** | ❌ No for public endpoints | Only for OAuth / app identity. For random photo and search, Access Key is enough. |

## Public authentication (what we use)

For `/photos/random` and `/search/photos`, Unsplash uses **Public** auth with the **Access Key**:

- **Header:** `Authorization: Client-ID YOUR_ACCESS_KEY`
- **Query (alternative):** `?client_id=YOUR_ACCESS_KEY`

This app uses the **header** form. The Access Key is sent in `NEXT_PUBLIC_*` because the request runs in the browser.

## Security

- **Never** put the **Secret Key** in any `NEXT_PUBLIC_*` variable — it would be exposed in the client.
- Keep `.env.local` out of git (it should be in `.gitignore`). If the Secret was ever committed, revoke it in the [Unsplash Developer](https://unsplash.com/oauth/applications) dashboard and create a new one.

## .env.local example

```bash
# Unsplash: Access Key only for NEXT_PUBLIC_
NEXT_PUBLIC_UNSPLASH_ACCESS_KEY=your_access_key_here

# Optional, server-side only (e.g. OAuth). Do not use NEXT_PUBLIC_.
# UNSPLASH_SECRET_KEY=your_secret_key_here
```
