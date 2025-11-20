# Send Time Registration Email Function

This Supabase Edge Function sends email notifications to ZZP'ers when they register or update their time entries.

## Setup Instructions

### 1. Configure Email Service Provider (Resend)

1. Sign up for a [Resend](https://resend.com) account
2. Verify your domain or use their test domain
3. Get your API key from the Resend dashboard

### 2. Add Secrets to Supabase

In your Supabase project dashboard:

1. Go to **Edge Functions** → **Secrets**
2. Add the following secret:
   - Name: `RESEND_API_KEY`
   - Value: Your Resend API key

### 3. Deploy the Edge Function

Using the Supabase CLI:

```bash
# Make sure you're logged in to Supabase CLI
supabase login

# Link your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy send-time-registration-email
```

### 4. Enable pg_net Extension

The database trigger uses the `pg_net` extension to make HTTP requests. Enable it in your Supabase project:

1. Go to **Database** → **Extensions**
2. Search for `pg_net`
3. Enable the extension

### 5. Configure App Settings

Add the following settings to your Supabase project (these are used by the database trigger):

```sql
-- Run these in your SQL Editor
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project-ref.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
```

Replace:
- `your-project-ref` with your actual Supabase project reference
- `your-service-role-key` with your actual service role key

### 6. Run the Migration

Apply the database trigger migration:

```bash
supabase db push
```

## How It Works

1. **Trigger**: When a time registration is inserted or updated, the database trigger fires
2. **Function Call**: The trigger calls the Edge Function with the registration data
3. **Role Check**: The function checks if the user is a ZZP'er
4. **Email Sending**: If the user is a ZZP'er, an email is sent with registration details
5. **Confirmation**: The function returns success/failure status

## Email Content

The email includes:
- Registration date and time
- Project information
- Work type and hours
- Work description
- Current status
- Professional HTML formatting

## Testing

You can test the function manually:

```bash
# Test the function directly
supabase functions invoke send-time-registration-email --data '{
  "record": {
    "id": "test-id",
    "user_id": "user-uuid",
    "datum": "2024-01-15",
    "werktype": "projectbasis",
    "aantal_uren": 8,
    "werkomschrijving": "Test work description",
    "status": "in-behandeling",
    "created_at": "2024-01-15T10:00:00Z"
  }
}'
```

## Troubleshooting

### Common Issues:

1. **Function not found**: Make sure the function is deployed
2. **Email not sending**: Check your Resend API key and domain verification
3. **Trigger not firing**: Verify the migration was applied and pg_net is enabled
4. **Permission errors**: Ensure app settings are configured correctly

### Logs:

Check function logs in your Supabase dashboard under **Edge Functions** → **Logs**.

## Customization

You can customize:
- Email template in the `emailHtml` variable
- Sender email address (must be verified in Resend)
- Email subject line
- Which events trigger emails (currently INSERT and status UPDATE)