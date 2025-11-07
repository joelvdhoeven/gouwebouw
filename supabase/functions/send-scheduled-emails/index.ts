import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailTemplate {
  id: string;
  name: string;
  type: 'missing_hours' | 'weekly_overview';
  subject: string;
  body: string;
  enabled: boolean;
}

interface EmailSchedule {
  id: string;
  template_id: string;
  schedule_type: 'weekly' | 'daily';
  day_of_week: number | null;
  hour: number;
  target_roles: string[] | null;
  target_users: string[] | null;
  hours_check_type: 'weekly' | 'daily' | null;
  minimum_weekly_hours: number | null;
  minimum_daily_hours: number | null;
  enabled: boolean;
  template: EmailTemplate;
}

interface UserProfile {
  id: string;
  naam: string;
  email: string;
  role: string;
}

interface TimeRegistration {
  id: string;
  user_id: string;
  project_id: string | null;
  datum: string;
  aantal_uren: number;
  project_naam: string | null;
  projects?: {
    naam: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const requestBody = await req.json().catch(() => ({}));
    const { test_mode = false, schedule_id = null, test_recipient = null } = requestBody;

    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    console.log('=== FUNCTION START ===');
    console.log('Function called with:', { test_mode, schedule_id, test_recipient, currentDay, currentHour });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('=== SECRET DEBUG INFO ===');
    console.log('POSTMARK_SERVER_TOKEN exists:', !!Deno.env.get('POSTMARK_SERVER_TOKEN'));
    console.log('POSTMARK_FROM_EMAIL:', Deno.env.get('POSTMARK_FROM_EMAIL'));
    console.log('=== END SECRET DEBUG INFO ===');

    let schedules;
    let schedulesError;

    if (test_mode && schedule_id) {
      console.log(`=== TEST MODE: Fetching schedule ${schedule_id} ===`);

      const { data, error } = await supabaseClient
        .from('email_schedules')
        .select(`
          *,
          template:email_templates(*)
        `)
        .eq('id', schedule_id)
        .single();

      console.log('Schedule query result:', { data, error });
      schedules = data ? [data] : [];
      schedulesError = error;
    } else {
      console.log(`Running scheduled email check for day ${currentDay}, hour ${currentHour}`);

      const { data, error } = await supabaseClient
        .from('email_schedules')
        .select(`
          *,
          template:email_templates(*)
        `)
        .eq('enabled', true)
        .eq('day_of_week', currentDay)
        .eq('hour', currentHour);

      schedules = data || [];
      schedulesError = error;
    }

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    console.log(`=== SCHEDULES FOUND: ${schedules.length} ===`);
    schedules.forEach((schedule: any, index: number) => {
      console.log(`Schedule ${index + 1}:`, {
        id: schedule.id,
        template_name: schedule.template?.name,
        target_roles: schedule.target_roles,
        target_users: schedule.target_users,
        hours_check_type: schedule.hours_check_type,
        minimum_weekly_hours: schedule.minimum_weekly_hours,
        minimum_daily_hours: schedule.minimum_daily_hours
      });
    });

    if (!schedules.length) {
      return new Response(JSON.stringify({
        message: test_mode ? `No schedule found with id ${schedule_id}` : 'No schedules found for current time',
        test_mode,
        schedule_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const emailsSent = [];
    const errors = [];

    for (const schedule of schedules) {
      try {
        const template = schedule.template as EmailTemplate;

        if (!template || !template.enabled) {
          console.log(`=== SKIPPING SCHEDULE ${schedule.id} - template disabled or missing ===`);
          continue;
        }

        console.log(`=== PROCESSING SCHEDULE: ${template.name} (${template.type}) ===`);
        console.log('Target roles:', schedule.target_roles);
        console.log('Target users:', schedule.target_users);

        let data, error;

        if (test_mode && test_recipient) {
          const { data: currentUserData, error: currentUserError } = await supabaseClient
            .from('profiles')
            .select('id, naam, email, role')
            .eq('email', test_recipient)
            .maybeSingle();

          data = currentUserData ? [currentUserData] : [];
          error = currentUserError;
          console.log('TEST MODE: Targeting test recipient:', test_recipient, 'Found:', !!currentUserData);
        } else if (schedule.target_users && schedule.target_users.length > 0) {
          const result = await supabaseClient
            .from('profiles')
            .select('id, naam, email, role')
            .in('id', schedule.target_users);
          data = result.data;
          error = result.error;
        } else if (schedule.target_roles && schedule.target_roles.length > 0) {
          const result = await supabaseClient
            .from('profiles')
            .select('id, naam, email, role')
            .in('role', schedule.target_roles);
          data = result.data;
          error = result.error;
        } else {
          data = [];
          error = null;
        }

        console.log('Target users query result:', {
          target_type: schedule.target_users?.length ? 'specific_users' : 'roles',
          target_roles: schedule.target_roles,
          target_users: schedule.target_users,
          count: data?.length || 0,
          error: error,
          users: data?.map((u: any) => ({ naam: u.naam, email: u.email, role: u.role }))
        });

        const users = data || [];
        const usersError = error;

        if (usersError) {
          console.error('Error fetching users:', usersError);
          errors.push(`Error fetching users for ${template.name}: ${usersError.message}`);
          continue;
        }

        if (!users.length) {
          const targetInfo = schedule.target_users?.length
            ? `user IDs: ${schedule.target_users.join(', ')}`
            : schedule.target_roles?.length
              ? `roles: ${schedule.target_roles.join(', ')}`
              : 'no targets specified';
          const message = `No users found for ${targetInfo}`;
          console.log('=== NO USERS FOUND ===', message);

          if (!test_mode) {
            continue;
          }
          console.log('=== BUT IN TEST MODE - will send guaranteed test email ===');
        } else {
          console.log(`=== FOUND ${users.length} USERS FOR PROCESSING ===`);
        }

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        console.log('Week range:', { startOfWeek: startOfWeek.toISOString(), endOfWeek: endOfWeek.toISOString() });

        for (const user of users) {
          try {
            let shouldSendEmail = false;
            let emailData: any = {
              user_name: user.naam,
              app_url: Deno.env.get('APP_URL') || 'https://gouwebouw-urenregist-0p5q.bolt.host',
              week_number: getWeekNumber(now),
              week_start_date: startOfWeek.toLocaleDateString('nl-NL'),
              week_end_date: endOfWeek.toLocaleDateString('nl-NL')
            };

            console.log(`=== PROCESSING USER: ${user.naam} (${user.email}) ===`);

            const { data: timeRegistrations, error: timeError } = await supabaseClient
              .from('time_registrations')
              .select(`
                id,
                user_id,
                project_id,
                datum,
                aantal_uren,
                project_naam,
                projects:project_id(naam)
              `)
              .eq('user_id', user.id)
              .gte('datum', startOfWeek.toISOString().split('T')[0])
              .lte('datum', endOfWeek.toISOString().split('T')[0]);

            console.log('Time registrations query:', {
              user_id: user.id,
              date_range: `${startOfWeek.toISOString().split('T')[0]} to ${endOfWeek.toISOString().split('T')[0]}`,
              result_count: timeRegistrations?.length || 0,
              error: timeError
            });

            if (timeError) {
              console.error(`Error fetching time registrations for user ${user.naam}:`, timeError);
              continue;
            }

            const registrations = timeRegistrations || [];
            const totalHours = registrations.reduce((sum: number, reg: any) => sum + reg.aantal_uren, 0);

            console.log(`User ${user.naam}: ${totalHours} hours from ${registrations.length} registrations`);

            if (template.type === 'missing_hours') {
              const minimumHours = schedule.hours_check_type === 'daily'
                ? (schedule.minimum_daily_hours || 8)
                : (schedule.minimum_weekly_hours || 40);

              if (totalHours < minimumHours) {
                shouldSendEmail = true;
                emailData.hours_filled = totalHours;
                emailData.minimum_hours = minimumHours;
                emailData.missing_hours = minimumHours - totalHours;
                emailData.hours_check_type = schedule.hours_check_type || 'weekly';
                console.log(`✅ WILL SEND missing hours email to ${user.naam} (${totalHours}h < ${minimumHours}h, check type: ${schedule.hours_check_type || 'weekly'})`);
              } else {
                console.log(`❌ Will NOT send to ${user.naam} (${totalHours}h >= ${minimumHours}h)`);
              }
            } else if (template.type === 'weekly_overview') {
              shouldSendEmail = true;
              console.log(`✅ WILL SEND weekly overview to ${user.naam}`);
              emailData.total_hours = totalHours;
              emailData.total_registrations = registrations.length;

              const projectHours = registrations.reduce((acc: any, reg: any) => {
                const projectName = reg.projects?.naam || reg.project_naam || 'Geen project';
                acc[projectName] = (acc[projectName] || 0) + reg.aantal_uren;
                return acc;
              }, {} as Record<string, number>);

              emailData.projects = Object.entries(projectHours).map(([name, hours]) => ({
                project_name: name,
                hours
              }));
            }

            if (shouldSendEmail) {
              const processedSubject = processTemplate(template.subject, emailData);
              const processedBody = processTemplate(template.body, emailData);

              const emailResult = await sendEmail(user.email, processedSubject, processedBody);

              await supabaseClient
                .from('email_logs')
                .insert({
                  template_id: template.id,
                  user_id: user.id,
                  to_email: user.email,
                  subject: processedSubject,
                  body_html: processedBody,
                  status: emailResult.success ? 'sent' : 'failed',
                  error: emailResult.error || null,
                  meta: test_mode ? {
                    test_mode: true,
                    schedule_id,
                    dry_run: false
                  } : {
                    dry_run: false
                  }
                });

              if (emailResult.success) {
                emailsSent.push({
                  user: user.naam,
                  email: user.email,
                  template: template.name,
                  type: template.type,
                  test_mode
                });
                console.log(`✅ ${test_mode ? 'Test e' : 'E'}mail sent to ${user.naam} (${user.email}) - ${template.name}`);
              } else {
                errors.push(`Failed to send email to ${user.naam}: ${emailResult.error}`);
                console.error(`❌ Failed to send email to ${user.naam}:`, emailResult.error);
              }
            }
          } catch (userError: any) {
            console.error(`Error processing user ${user.naam}:`, userError);
            errors.push(`Error processing user ${user.naam}: ${userError.message}`);
          }
        }

        if (test_mode && test_recipient) {
          console.log(`=== TEST MODE: Sending guaranteed test email to ${test_recipient} ===`);

          const alreadySent = emailsSent.some((sent: any) => sent.email === test_recipient);

          if (!alreadySent) {
            try {
              const minimumHours = schedule.hours_check_type === 'daily'
                ? (schedule.minimum_daily_hours || 8)
                : (schedule.minimum_weekly_hours || 40);

              const testEmailData = {
                user_name: 'Test Gebruiker',
                app_url: Deno.env.get('APP_URL') || 'https://gouwebouw-urenregist-0p5q.bolt.host',
                week_number: getWeekNumber(now),
                week_start_date: startOfWeek.toLocaleDateString('nl-NL'),
                week_end_date: endOfWeek.toLocaleDateString('nl-NL'),
                hours_filled: 6,
                minimum_hours: minimumHours,
                missing_hours: Math.max(0, minimumHours - 6),
                hours_check_type: schedule.hours_check_type || 'weekly',
                total_hours: 6,
                total_registrations: 2,
                projects: [
                  { project_name: 'Test Project A', hours: 4 },
                  { project_name: 'Test Project B', hours: 2 }
                ]
              };

              const testSubject = `[TEST] ${processTemplate(template.subject, testEmailData)}`;
              const testBody = `[Dit is een test email]\n\n${processTemplate(template.body, testEmailData)}`;

              const testEmailResult = await sendEmail(test_recipient, testSubject, testBody);

              await supabaseClient
                .from('email_logs')
                .insert({
                  template_id: template.id,
                  user_id: null,
                  to_email: test_recipient,
                  subject: testSubject,
                  body_html: testBody,
                  status: testEmailResult.success ? 'sent' : 'failed',
                  error: testEmailResult.error || null,
                  meta: {
                    test_mode: true,
                    schedule_id,
                    guaranteed_test: true,
                    dry_run: false
                  }
                });

              if (testEmailResult.success) {
                emailsSent.push({
                  user: 'Test Gebruiker',
                  email: test_recipient,
                  template: template.name,
                  type: template.type,
                  test_mode: true
                });
                console.log(`✅ Guaranteed test email sent to ${test_recipient}`);
              } else {
                errors.push(`Failed to send guaranteed test email to ${test_recipient}: ${testEmailResult.error}`);
                console.error(`❌ Failed to send guaranteed test email:`, testEmailResult.error);
              }
            } catch (testError: any) {
              console.error(`Error sending guaranteed test email:`, testError);
              errors.push(`Error sending guaranteed test email: ${testError.message}`);
            }
          } else {
            console.log(`✅ Test recipient ${test_recipient} already received an email from regular processing`);
          }
        }
      } catch (scheduleError: any) {
        console.error(`Error processing schedule ${schedule.id}:`, scheduleError);
        errors.push(`Error processing schedule: ${scheduleError.message}`);
      }
    }

    const summary = {
      message: test_mode ? 'Test email processing completed' : 'Scheduled email processing completed',
      emailsSent: emailsSent.length,
      errors: errors.length,
      schedules_processed: schedules.length,
      test_mode,
      details: {
        sent: emailsSent,
        errors: errors
      },
      timestamp: new Date().toISOString()
    };

    console.log('=== FINAL SUMMARY ===', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in send-scheduled-emails function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

function processTemplate(template: string, data: any): string {
  let processed = template;

  Object.keys(data).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = data[key];
    if (typeof value === 'string' || typeof value === 'number') {
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    }
  });

  if (data.projects && Array.isArray(data.projects)) {
    const projectListRegex = /\{\{#if projects\}\}([\s\S]*?)\{\{\/if\}\}/g;
    const projectItemRegex = /\{\{#each projects\}\}([\s\S]*?)\{\{\/each\}\}/g;

    if (data.projects.length > 0) {
      processed = processed.replace(projectListRegex, '$1');

      const projectItems = data.projects.map((project: any) => {
        let item = '- {{project_name}}: {{hours}} uren';
        item = item.replace('{{project_name}}', project.project_name);
        item = item.replace('{{hours}}', String(project.hours));
        return item;
      }).join('\n');

      processed = processed.replace(projectItemRegex, projectItems);
    } else {
      processed = processed.replace(projectListRegex, '');
    }
  }

  return processed;
}

async function sendEmail(to: string, subject: string, body: string): Promise<{success: boolean, error?: string}> {
  try {
    const postmarkToken = Deno.env.get('POSTMARK_SERVER_TOKEN');
    const fromEmail = Deno.env.get('POSTMARK_FROM_EMAIL') || 'Info@hoevensolutions.nl';

    if (!postmarkToken) {
      return { success: false, error: 'POSTMARK_SERVER_TOKEN not configured' };
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            pre { white-space: pre-wrap; font-family: inherit; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GouweBouw Urenregistratie</h1>
          </div>
          <div class="content">
            <pre>${body}</pre>
          </div>
          <div class="footer">
            <p>Dit is een automatisch gegenereerde e-mail van het GouweBouw systeem.</p>
            <p>© ${new Date().getFullYear()} GouweBouw - Alle rechten voorbehouden</p>
          </div>
        </body>
      </html>
    `;

    const textBody = body.replace(/<[^>]*>/g, '');

    console.log('Sending email via Postmark to:', to);

    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': postmarkToken,
      },
      body: JSON.stringify({
        From: fromEmail,
        To: to,
        Subject: subject,
        HtmlBody: emailHtml,
        TextBody: textBody,
        MessageStream: 'outbound'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Postmark API error:', errorText);
      return { success: false, error: `Postmark API error: ${errorText}` };
    }

    const result = await response.json();
    console.log('Postmark response:', result);

    return { success: true };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
