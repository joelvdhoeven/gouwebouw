import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimeRegistration {
  id: string
  user_id: string
  project_id: string | null
  datum: string
  werktype: string
  aantal_uren: number
  werkomschrijving: string
  project_naam: string | null
  locatie: string | null
  status: string
  created_at: string
  updated_at: string
}

interface UserProfile {
  id: string
  naam: string
  email: string
  role: string
}

interface Project {
  id: string
  naam: string
  project_nummer: string | null
  locatie: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the time registration data from the request
    const { record } = await req.json()
    const timeRegistration: TimeRegistration = record

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user profile to check role and email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', timeRegistration.user_id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const userProfile: UserProfile = profile

    // Only send email if user is a ZZP'er
    if (userProfile.role !== 'zzper') {
      return new Response(
        JSON.stringify({ message: 'Email not sent - user is not a ZZP\'er' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get project details if project_id exists
    let projectDetails: Project | null = null
    if (timeRegistration.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', timeRegistration.project_id)
        .single()
      
      projectDetails = project
    }

    // Prepare email content
    const projectInfo = projectDetails 
      ? `${projectDetails.naam} (${projectDetails.project_nummer || 'Geen nummer'})`
      : timeRegistration.project_naam || 'Geen project'

    const emailSubject = `Urenregistratie bevestiging - ${new Date(timeRegistration.datum).toLocaleDateString('nl-NL')}`
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Urenregistratie Bevestiging</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-left: 4px solid #dc2626; }
            .label { font-weight: bold; color: #dc2626; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            .status { 
              display: inline-block; 
              padding: 4px 12px; 
              border-radius: 20px; 
              font-size: 12px; 
              font-weight: bold;
            }
            .status-pending { background-color: #fef3c7; color: #92400e; }
            .status-approved { background-color: #d1fae5; color: #065f46; }
            .status-rejected { background-color: #fee2e2; color: #991b1b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🕐 Urenregistratie Bevestiging</h1>
              <p>Uw urenregistratie is succesvol ontvangen</p>
            </div>
            
            <div class="content">
              <p>Beste ${userProfile.naam},</p>
              <p>Uw urenregistratie is succesvol geregistreerd in het systeem. Hieronder vindt u een overzicht van de geregistreerde gegevens:</p>
              
              <div class="detail-row">
                <span class="label">Datum:</span> ${new Date(timeRegistration.datum).toLocaleDateString('nl-NL', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              
              <div class="detail-row">
                <span class="label">Project:</span> ${projectInfo}
              </div>
              
              <div class="detail-row">
                <span class="label">Werktype:</span> ${timeRegistration.werktype}
              </div>
              
              <div class="detail-row">
                <span class="label">Aantal uren:</span> ${timeRegistration.aantal_uren} uur
              </div>
              
              ${timeRegistration.locatie ? `
              <div class="detail-row">
                <span class="label">Locatie:</span> ${timeRegistration.locatie}
              </div>
              ` : ''}
              
              <div class="detail-row">
                <span class="label">Werkomschrijving:</span><br>
                ${timeRegistration.werkomschrijving}
              </div>
              
              <div class="detail-row">
                <span class="label">Status:</span> 
                <span class="status status-pending">In behandeling</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Geregistreerd op:</span> ${new Date(timeRegistration.created_at).toLocaleString('nl-NL')}
              </div>
            </div>
            
            <div class="footer">
              <p>Dit is een automatisch gegenereerde e-mail van het GouweBouw urenregistratie systeem.</p>
              <p>© ${new Date().getFullYear()} GouweBouw - Alle rechten voorbehouden</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email using Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not found in environment variables')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GouweBouw <noreply@gouwebouw.nl>', // Replace with your verified domain
        to: [userProfile.email],
        subject: emailSubject,
        html: emailHtml,
      }),
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      console.error('Failed to send email:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorText }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const emailResult = await emailResponse.json()
    console.log('Email sent successfully:', emailResult)

    return new Response(
      JSON.stringify({ 
        message: 'Email sent successfully', 
        emailId: emailResult.id,
        recipient: userProfile.email 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-time-registration-email function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})