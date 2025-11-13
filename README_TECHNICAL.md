# Stream Live Hub - Technical Documentation

## 🏗️ Architecture Overview

Stream Live Hub is a full-stack live streaming platform built with:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions + Storage + Realtime)
- **Video Streaming**: Daily.co WebRTC
- **Payments**: Mercado Pago API
- **Email**: Resend API

## 📂 Project Structure

```
stream-live-hub/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── ui/             # shadcn-ui components
│   │   ├── ChatBox.tsx     # Live chat component
│   │   ├── ChatModerationPanel.tsx  # Chat moderation controls
│   │   ├── CreatorCard.tsx # Creator profile card
│   │   ├── DailyVideoPlayer.tsx     # Video player with Daily.co
│   │   ├── Navbar.tsx      # Navigation bar
│   │   ├── SuperChatDialog.tsx      # SuperChat payment dialog
│   │   └── VideoPreview.tsx         # 30s preview component
│   │
│   ├── pages/              # Page components (routes)
│   │   ├── Auth.tsx        # Login/signup page
│   │   ├── Home.tsx        # Public homepage
│   │   ├── Dashboard.tsx   # Creator dashboard
│   │   ├── LiveManagement.tsx  # Live control panel
│   │   ├── Room.tsx        # Viewer live room
│   │   ├── Profile.tsx     # User profile management
│   │   ├── Affiliate.tsx   # Affiliate dashboard
│   │   ├── Subscribe.tsx   # Subscription page
│   │   └── Admin.tsx       # Admin panel
│   │
│   ├── hooks/              # Custom React hooks
│   │   ├── useLanguage.tsx # i18n hook
│   │   └── use-toast.ts    # Toast notifications
│   │
│   ├── lib/                # Utility functions
│   │   ├── utils.ts        # General utilities
│   │   ├── payments.ts     # Payment helpers
│   │   ├── daily.ts        # Daily.co helpers
│   │   └── i18n.ts         # Internationalization
│   │
│   ├── integrations/       # External integrations
│   │   └── supabase/       # Supabase client & types
│   │
│   └── index.css           # Global styles & design tokens
│
├── supabase/
│   ├── functions/          # Edge Functions (serverless)
│   │   ├── create-daily-room/      # Create Daily.co rooms
│   │   ├── create-payment/         # Mercado Pago payments
│   │   ├── mercadopago-webhook/    # Payment webhooks
│   │   ├── send-email/             # Email sender
│   │   └── send-notification-email/ # Notification emails
│   │
│   ├── migrations/         # Database schema migrations
│   └── config.toml         # Supabase configuration
│
└── public/                 # Static assets
```

## 🗄️ Database Schema

### Core Tables

#### `profiles`
User profile information
- `id` (uuid, PK) - References auth.users
- `username` (text) - Unique username
- `avatar_url` (text) - Profile image URL
- `website` (text) - Personal website
- `bio` (text) - User biography
- `gender` (text) - Gender identity
- `balance` (numeric) - Account balance
- `referral_code` (text) - Unique referral code
- `referred_by` (uuid) - Referrer user ID

#### `user_roles`
Role-based access control
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `role` (app_role enum) - 'admin', 'creator', 'viewer'

#### `creator_profiles`
Creator-specific data
- `id` (uuid, PK, FK → profiles)
- `display_name` (text) - Public display name
- `bio` (text) - Creator bio
- `tags` (text[]) - Content tags
- `is_streaming` (boolean) - Current streaming status
- `viewer_count` (integer) - Current viewers
- `daily_room_url` (text) - Daily.co room URL
- `daily_room_name` (text) - Daily.co room name

#### `rooms`
Live streaming rooms
- `id` (uuid, PK)
- `creator_id` (uuid, FK → profiles)
- `title` (text) - Stream title
- `is_active` (boolean) - Active status
- `viewer_count` (integer) - Current viewers
- `daily_room_name` (text) - Daily.co room name
- `created_at` (timestamp)
- `ended_at` (timestamp)

#### `subscriptions`
User subscriptions to creators
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `creator_id` (uuid, FK → profiles)
- `status` (text) - 'active', 'cancelled', 'expired'
- `started_at` (timestamp)
- `expires_at` (timestamp)
- `cancelled_at` (timestamp)

#### `transactions`
Financial transactions
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles) - Payer
- `creator_id` (uuid, FK → profiles) - Payee
- `affiliate_id` (uuid, FK → profiles) - Affiliate (if any)
- `type` (text) - 'subscription', 'superchat'
- `amount` (numeric) - Total amount
- `creator_amount` (numeric) - Creator's share
- `platform_amount` (numeric) - Platform's share
- `affiliate_amount` (numeric) - Affiliate's share
- `status` (text) - 'pending', 'approved', 'failed'
- `external_id` (text) - Mercado Pago ID
- `metadata` (jsonb) - Additional data

#### `messages`
Chat messages
- `id` (uuid, PK)
- `room_id` (uuid, FK → rooms)
- `user_id` (uuid, FK → profiles)
- `content` (text) - Message content
- `created_at` (timestamp)

#### `chat_settings`
Chat moderation settings
- `id` (uuid, PK)
- `room_id` (uuid, FK → rooms)
- `subscribers_only` (boolean)
- `slow_mode_enabled` (boolean)
- `slow_mode_duration` (integer) - Seconds between messages
- `banned_words` (text[])

#### `banned_users`
Banned users from rooms
- `id` (uuid, PK)
- `room_id` (uuid, FK → rooms)
- `user_id` (uuid, FK → profiles)
- `banned_by` (uuid, FK → profiles)
- `is_permanent` (boolean)
- `reason` (text)
- `expires_at` (timestamp)

#### `payout_requests`
Creator payout requests
- `id` (uuid, PK)
- `creator_id` (uuid, FK → profiles)
- `amount` (numeric)
- `status` (text) - 'pending', 'approved', 'paid', 'rejected'
- `bank_account_id` (uuid, FK → creator_bank_accounts)
- `approved_by` (uuid, FK → profiles)
- `approved_at` (timestamp)
- `paid_at` (timestamp)
- `admin_notes` (text)

## 🔐 Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users can only read/write their own data
- Creators can manage their own rooms and settings
- Admins have full access (using `has_role()` function)

### Key Security Functions

```sql
-- Check if user has specific role
CREATE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
SECURITY DEFINER
SET search_path = public;

-- Check if user is subscribed to creator
CREATE FUNCTION is_subscribed_to_creator(_user_id uuid, _creator_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public;
```

## 🌐 Edge Functions

### `create-daily-room`
Creates Daily.co video rooms for live streaming
- **Method**: POST
- **Auth**: Required
- **Body**: `{ roomTitle: string }`
- **Returns**: `{ room: DailyRoom }`

### `create-payment`
Creates Mercado Pago payment links
- **Method**: POST
- **Auth**: Required
- **Body**: `{ creatorId, userId, type, amount?, description? }`
- **Returns**: `{ init_point: string }`

### `mercadopago-webhook`
Handles Mercado Pago payment notifications
- **Method**: POST
- **Auth**: Public (webhook)
- **Body**: Mercado Pago webhook payload
- **Actions**: Updates transactions, subscriptions, balances

### `send-notification-email`
Sends transactional emails via Resend
- **Method**: POST
- **Auth**: Required
- **Body**: `{ to, subject, html, type }`
- **Returns**: `{ emailId }`

## 🎨 Design System

Theme colors defined in `src/index.css`:

```css
:root {
  --background: 0 0% 0%;        /* Pure black */
  --foreground: 0 0% 98%;       /* Almost white */
  --primary: 270 80% 55%;       /* Vibrant purple #8B45F0 */
  --primary-glow: 270 80% 65%;  /* Lighter purple */
  --secondary: 0 0% 10%;        /* Dark gray */
  --muted: 0 0% 15%;            /* Medium gray */
  --accent: 270 80% 55%;        /* Accent purple */
  --success: 142 76% 36%;       /* Green */
  --destructive: 0 84% 60%;     /* Red */
  --border: 0 0% 15%;           /* Border gray */
}
```

## 🔧 Environment Variables

Create `.env` file (auto-generated by Supabase):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

### Supabase Secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions:

```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx
DAILY_API_KEY=xxx
RESEND_API_KEY=re_xxx
```

## 🚀 Deployment

### Frontend (Lovable / Vercel)

1. Connect repository to Lovable or Vercel
2. Set environment variables
3. Deploy automatically on git push

### Backend (Supabase)

Edge functions deploy automatically when you push to git.

To manually deploy:

```bash
supabase functions deploy create-daily-room
supabase functions deploy create-payment
supabase functions deploy mercadopago-webhook
supabase functions deploy send-notification-email
```

### Database Migrations

Migrations run automatically in Lovable Cloud.

To manually run:

```bash
supabase db push
```

## 🔄 Real-time Features

Supabase Realtime is enabled for:
- `messages` - Live chat
- `room_participants` - Viewer count
- `transactions` - Revenue updates

Enable realtime on a table:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_name;
```

## 🧪 Testing

### Test User Flows

1. **Viewer Registration**
   - Sign up as viewer
   - Browse creators
   - Watch preview (30s)
   - Subscribe to creator
   - Join live room
   - Send chat messages
   - Send SuperChat

2. **Creator Workflow**
   - Sign up as creator
   - Set up profile (upload avatar, bio)
   - Go live (camera/mic permissions)
   - Monitor viewer count
   - Moderate chat
   - Check revenue
   - Request payout

3. **Admin Operations**
   - Log in as admin
   - View all users
   - Manage financial settings
   - Approve payouts
   - View analytics

## 🐛 Common Issues

### "Invalid JWT" errors
- Check Supabase anon key is correct
- Verify user session is active

### "RLS policy violation"
- Check user has correct role
- Verify user_id matches auth.uid()

### Payments not processing
- Check Mercado Pago API key
- Verify webhook URL is public
- Check transaction status in database

### Video not streaming
- Check Daily.co API key
- Verify browser camera/mic permissions
- Check daily_room_url is set

## 📊 Analytics & Monitoring

Monitor via Supabase Dashboard:
- Database queries (Logs → Database)
- Edge function logs (Logs → Edge Functions)
- Authentication events (Authentication → Users)
- Storage usage (Storage → Usage)

## 🔗 External APIs

### Daily.co
- **Docs**: https://docs.daily.co/
- **API Key**: Set in Supabase secrets
- **Rate Limits**: 100 rooms/hour on free tier

### Mercado Pago
- **Docs**: https://www.mercadopago.com.br/developers
- **API Key**: `MERCADOPAGO_ACCESS_TOKEN`
- **Webhook**: `https://your-project.supabase.co/functions/v1/mercadopago-webhook`

### Resend
- **Docs**: https://resend.com/docs
- **API Key**: `RESEND_API_KEY`
- **From Email**: Must be verified domain

## 👨‍💻 Development Tips

- Use TypeScript for type safety
- Follow existing component patterns
- Keep components small and focused
- Use shadcn-ui components for UI
- Follow RLS patterns for security
- Test with different user roles
- Use Supabase Studio for database management

## 📝 Code Style

- **React**: Functional components with hooks
- **TypeScript**: Strict mode enabled
- **Naming**: camelCase for variables, PascalCase for components
- **CSS**: Tailwind utility classes + semantic tokens
- **Imports**: Organized (React → libraries → components → utils)

## 🆘 Support

For technical issues:
1. Check Supabase logs
2. Review RLS policies
3. Verify environment variables
4. Test API keys
5. Check browser console for errors

## 🔄 Update Process

1. Pull latest changes from git
2. Review migration files in `supabase/migrations/`
3. Deploy edge functions if changed
4. Test in staging environment
5. Deploy to production
6. Monitor logs for errors
