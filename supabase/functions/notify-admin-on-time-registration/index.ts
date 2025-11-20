```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    const timeRegistration = record

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch the user who submitted the time registration
    const { data: submitterProfile, error: submitterError } = await supabaseClient
      .from('profiles')
      .select('id, naam')
      .eq('id', timeRegistration.user_id)
      .single()

    if (submitterError) throw submitterError

    // Fetch all admin and kantoorpersoneel profiles
    const { data: adminAndOfficeProfiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, naam, role')
      .in('role', ['admin', 'kantoorpersoneel'])

    if (profilesError) throw profilesError

    const notificationTitle = \`Nieuwe urenregistratie van ${submitterProfile.naam}`
    const notificationMessage = \`Medewerker ${submitterProfile.naam} heeft op ${new Date(timeRegistration.datum).toLocaleDateString('nl-NL')} ${timeRegistration.aantal_uren} uur geregistreerd voor ${timeRegistration.project_naam || 'een project'}. Werktype: ${timeRegistration.werktype}. Beschrijving: ${timeRegistration.werkomschrijving}`

    const notificationsToInsert = adminAndOfficeProfiles.map(profile => ({
      recipient_id: profile.id,
      sender_id: submitterProfile.id,
      type: 'time_registration_submitted',
      title: notificationTitle,
      message: notificationMessage,
      related_entity_type: 'time_registration',
      related_entity_id: timeRegistration.id,
      status: 'unread',
    }))

    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('notifications')
        .insert(notificationsToInsert)

      if (insertError) throw insertError
    }

    return new Response(JSON.stringify({ message: 'Notifications created successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in notify-admin-on-time-registration function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
```