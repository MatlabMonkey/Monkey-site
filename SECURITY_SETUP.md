# Security Setup Guide

This guide explains how to set up the hybrid security approach for your personal website.

## 🔐 Security Layers

### Layer 1: Frontend PIN Protection
- Dashboard and todos require PIN: `2245`
- Change this in `app/components/PinGate.tsx`

### Layer 2: API Key Authentication
- All database requests require a secret API key
- Prevents unauthorized access to your private data

## 🚀 Setup Instructions

### Step 1: Generate a Secure API Key
Create a strong, random API key. You can use:
- A password generator
- A UUID generator
- Or use this example: `sk-1234567890abcdef`

### Step 2: Update Environment Variables
Add the API key to your `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_KEY=your-secret-api-key-here
```

### Step 3: Update Database Policies
Replace `your-secret-api-key-here` in the migration file with your actual API key:

1. Edit `supabase/migrations/003_hybrid_security.sql`
2. Replace `your-secret-api-key-here` with your actual API key
3. Apply the migration to your database

### Step 4: Update Google Apps Script
Add the API key to your Google Apps Script:

```javascript
// Add this to your syncToSupabase function
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': 'your-secret-api-key-here'
};

// Use these headers in your fetch requests
```

## 🔒 Security Features

### ✅ What's Protected
- **Database Access**: Requires API key
- **Frontend Access**: Requires PIN
- **API Routes**: Inherit security from Supabase client
- **Google Apps Script**: Requires API key

### 🛡️ What's Not Protected
- **Public Routes**: Homepage is still public
- **Static Assets**: Images, CSS, JS files
- **Environment Variables**: Visible in browser (but that's okay for API keys in Next.js)

## 🔧 Customization

### Change the PIN
Edit `app/components/PinGate.tsx`:
```typescript
const CORRECT_PIN = "your-new-pin"
```

### Change the API Key
1. Update `.env.local`
2. Update `supabase/migrations/003_hybrid_security.sql`
3. Update your Google Apps Script
4. Apply the migration

### Add IP Restrictions (Optional)
Add this to your migration for extra security:
```sql
-- Only allow from specific IPs
AND inet_client_addr() = ANY(ARRAY['your.ip.address'])
```

## 🚨 Important Notes

1. **Keep your API key secret** - don't commit it to public repositories
2. **Change the default PIN** - `2245` is just for testing
3. **Use HTTPS in production** - always deploy with SSL
4. **Monitor access logs** - check Supabase logs for suspicious activity

## 🆘 Troubleshooting

### "Access denied" errors
- Check that API key is set correctly
- Verify the migration was applied
- Ensure environment variables are loaded

### Google Apps Script not working
- Add the API key to your script
- Check the headers in your fetch requests
- Verify the Supabase URL is correct

### Frontend not loading data
- Check browser console for errors
- Verify the API key is in environment variables
- Test the connection at `/test-supabase` 