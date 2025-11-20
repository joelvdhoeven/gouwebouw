import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserProfile {
  id: string
  naam: string
  email: string
  role: string
  last_activity_at: string | null
  created_at: string
}

interface NotificationRecord {
  id: string
  recipient_id: string
  type: string
  related_entity_id: string
  status: string
  created_at: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Define inactivity threshold (30 days)
    const inactivityThresholdDays = 30
    const inactivityThreshold = new Date()
    inactivityThreshold.setDate(inactivityThreshold.getDate() - inactivityThresholdDays)

    // Fetch all user profiles
    const { data: allProfiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, naam, email, role, last_activity_at, created_at')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }

    const profiles: UserProfile[] = allProfiles || []

    // Fetch admin and office staff to send notifications to
    const { data: adminAndOfficeProfiles, error: adminError } = await supabaseClient
      .from('profiles')
      .select('id, naam, role')
      .in('role', ['admin', 'kantoorpersoneel'])

    if (adminError) {
      console.error('Error fetching admin profiles:', adminError)
      throw adminError
    }

    const notificationsToInsert = []
    let inactiveCount = 0
    let reactivatedCount = 0

    for (const profile of profiles) {
      // Skip admin and office staff from activity monitoring
      if (profile.role === 'admin' || profile.role === 'kantoorpersoneel') {
        continue
      }

      const isCurrentlyInactive = !profile.last_activity_at || 
        new Date(profile.last_activity_at) < inactivityThreshold

      // Check if we already sent a notification for this user's current status
      const { data: existingNotifications, error: notificationError } = await supabaseClient
        .from('notifications')
        .select('id, type, created_at')
        .eq('related_entity_id', profile.id)
        .in('type', ['user_inactive', 'user_active'])
        .order('created_at', { ascending: false })
        .limit(1)

      if (notificationError) {
        console.error('Error fetching existing notifications:', notificationError)
        continue
      }

      const lastNotification = existingNotifications?.[0]
      const lastNotificationType = lastNotification?.type

      // Determine if we need to send a notification
      let shouldNotify = false
      let notificationType = ''
      let notificationTitle = ''
      let notificationMessage = ''

      if (isCurrentlyInactive && lastNotificationType !== 'user_inactive') {
        // User became inactive
        shouldNotify = true
        notificationType = 'user_inactive'
        notificationTitle = `Gebruiker ${profile.naam} is inactief geworden`
        
        const daysSinceLastActivity = profile.last_activity_at 
          ? Math.floor((new Date().getTime() - new Date(profile.last_activity_at).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
        
        notificationMessage = `Gebruiker ${profile.naam} (${profile.email}) heeft al ${daysSinceLastActivity} dagen geen tijdregistraties ingediend. Laatste activiteit: ${
          profile.last_activity_at 
            ? new Date(profile.last_activity_at).toLocaleDateString('nl-NL')
            : 'Nooit'
        }`
        inactiveCount++
      } else if (!isCurrentlyInactive && lastNotificationType === 'user_inactive') {
        // User became active again after being inactive
        shouldNotify = true
        notificationType = 'user_active'
        notificationTitle = `Gebruiker ${profile.naam} is weer actief geworden`
        notificationMessage = `Gebruiker ${profile.naam} (${profile.email}) heeft weer een tijdregistratie ingediend na een periode van inactiviteit. Laatste activiteit: ${new Date(profile.last_activity_at!).toLocaleDateString('nl-NL')}`
        reactivatedCount++
      }

      if (shouldNotify) {
        // Create notifications for all admin and office staff
        for (const adminProfile of adminAndOfficeProfiles) {
          notificationsToInsert.push({
            recipient_id: adminProfile.id,
            sender_id: null, // System notification
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            related_entity_type: 'user',
            related_entity_id: profile.id,
            status: 'unread',
          })
        }
      }
    }

    // Insert all notifications at once
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('notifications')
        .insert(notificationsToInsert)

      if (insertError) {
        console.error('Error inserting notifications:', insertError)
        throw insertError
      }
    }

    const summary = {
      message: 'User activity check completed successfully',
      totalUsersChecked: profiles.filter(p => p.role !== 'admin' && p.role !== 'kantoorpersoneel').length,
      newInactiveUsers: inactiveCount,
      reactivatedUsers: reactivatedCount,
      notificationsCreated: notificationsToInsert.length,
      timestamp: new Date().toISOString()
    }

    console.log('Activity check summary:', summary)

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in check-user-activity function:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})