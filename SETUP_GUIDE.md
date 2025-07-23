# Personal Website Setup Guide

This guide will help you get your personal website fully functional.

## 🚀 Quick Start

### 1. Set up Environment Variables

Create a `.env.local` file in your project root:

```bash
# Create the file
touch .env.local
```

Add your Supabase credentials to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**To get your Supabase credentials:**
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the Project URL and paste it as `NEXT_PUBLIC_SUPABASE_URL`
4. Copy the anon/public key and paste it as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Set up Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `database-setup.sql`
4. Run the SQL script

### 3. Test the Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:3000/test-supabase` to test the connection

3. If successful, you should see "Connection successful!" with sample data

### 4. Access Your Dashboard

1. Visit `http://localhost:3000/dashboard`
2. Enter the PIN: `2245`
3. You should now see your dashboard with data

## 🔧 Features Status

### ✅ Working Features
- **Dashboard**: Visualizes journal data with charts and metrics
- **Todo System**: Add, complete, and delete todos
- **Webhook API**: Add todos via API calls
- **PIN Protection**: Secure access to dashboard and todos

### 🔄 Partially Working
- **Landscape Image**: Fixed to use a reliable Unsplash image
- **Data Updates**: Will work once Supabase is connected

### 🚧 Needs Setup
- **Google Apps Script Integration**: Your script needs to send data to the `journal_entries` table
- **Webhook Authentication**: Currently open, can be secured later

## 📊 Dashboard Features

Your dashboard includes:
- **Quality of Life Tracking**: 7-day and yearly averages
- **Productivity Metrics**: Visualized with smooth charts
- **Habit Streaks**: Track consecutive days for workouts, reading, etc.
- **Workout Distribution**: Pie chart showing workout types
- **Random Highlights**: Shows past journal entries
- **Progress Rings**: Visual goal tracking

## 📝 Todo System Features

- **Quick Add**: Fast todo creation
- **Mark Complete**: Click to toggle completion
- **Delete**: Remove completed todos
- **Webhook API**: Add todos from external services
- **Real-time Updates**: Optimistic UI updates

## 🔗 API Endpoints

### Todos API
- `GET /api/todos` - Get all todos
- `POST /api/todos` - Create new todo
- `PATCH /api/todos/[id]` - Update todo
- `DELETE /api/todos/[id]` - Delete todo

### Webhook API
- `POST /api/webhook/todos` - Add todo via webhook

**Example webhook usage:**
```bash
curl -X POST http://localhost:3000/api/webhook/todos \
  -H "Content-Type: application/json" \
  -d '{"content": "New todo from webhook", "source": "curl"}'
```

## 🛠️ Troubleshooting

### Dashboard not loading data?
1. Check that environment variables are set correctly
2. Verify the `journal_entries` table exists in Supabase
3. Check browser console for errors
4. Visit `/test-supabase` to diagnose connection issues

### Todos not working?
1. Ensure the `todos` table exists in Supabase
2. Check that RLS policies allow read/write access
3. Verify API routes are accessible

### Image not loading?
- The homepage now uses a reliable Unsplash image
- If it still doesn't load, it will show the gradient background

## 🔐 Security Notes

- **PIN Protection**: Currently set to `2245` - change this in `app/components/PinGate.tsx`
- **Webhook Security**: Currently open - add authentication if needed
- **RLS Policies**: Currently allow all operations - restrict as needed

## 📈 Next Steps

1. **Connect Google Apps Script**: Update your script to send data to the `journal_entries` table
2. **Add More Features**: Consider adding mood tracking, habit goals, etc.
3. **Customize Design**: Modify colors, layouts, and components
4. **Add Authentication**: Implement proper user authentication
5. **Deploy**: Deploy to Vercel, Netlify, or your preferred platform

## 🆘 Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Supabase connection at `/test-supabase`
3. Ensure all environment variables are set correctly
4. Check that database tables exist and have the correct schema 