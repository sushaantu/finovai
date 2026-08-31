import type { Env } from './shared'

export async function sendOpsAlertEmail(env: Env, subject: string, lines: string[]): Promise<void> {
  if (!env.EMAIL || !env.OPS_ALERT_EMAIL) {
    console.error('OPS_ALERT_SKIPPED', subject, lines)
    return
  }

  const fromEmail = env.EMAIL_FROM || 'noreply@mail.finov.ai'
  const text = lines.join('\n')

  await env.EMAIL.send({
    to: env.OPS_ALERT_EMAIL,
    from: { email: fromEmail, name: 'FinovAI' },
    replyTo: fromEmail,
    subject,
    text,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#071326">
        <h1 style="font-size:20px">${subject}</h1>
        <pre style="white-space:pre-wrap">${text}</pre>
      </div>
    `,
  })
}
