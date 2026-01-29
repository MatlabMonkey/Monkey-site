# Todos Feature Specification

## Overview
A simple, fast todo management system with an "inbox" folder for capturing and managing tasks.

## Core Features

### 1. Todo Management
- **Add todos**: Quick input form to add new tasks
- **Toggle completion**: Mark todos as complete/incomplete
- **Delete todos**: Remove todos from the list
- **View todos**: Display all todos in the inbox folder

### 2. UI/UX
- **Optimistic updates**: UI updates immediately, syncs with server in background
- **Loading states**: Show loading indicators during operations
- **Empty state**: Friendly message when inbox is empty
- **Pending/Completed counts**: Display counts in header
- **Date formatting**: Show relative dates (e.g., "2h ago", "Yesterday")
- **PinGate protection**: Requires PIN to access (existing component)

### 3. Data Model
- **id**: UUID (string) - Primary key
- **content**: Text - The todo text
- **completed**: Boolean - Completion status
- **folder**: String - Always "inbox" for now
- **created_at**: Timestamp - When todo was created
- **updated_at**: Timestamp - Last update time

### 4. API Endpoints
- `GET /api/todos` - Fetch all todos from inbox
- `POST /api/todos` - Create a new todo
- `PATCH /api/todos/[id]` - Update a todo (toggle completion)
- `DELETE /api/todos/[id]` - Delete a todo

### 5. Optional Features (from previous implementation)
- **Webhook endpoint**: `POST /api/webhook/todos` - Allow external services to add todos
- **Folder system**: Currently only "inbox", but structure supports folders

## Technical Requirements
- Next.js App Router
- Supabase for data storage
- Client-side React components
- Server-side API routes
- TypeScript

## Design Notes
- Clean, modern UI with gradient backgrounds
- Fast, responsive interactions
- Error handling with user-friendly messages
- No complex features - keep it simple
