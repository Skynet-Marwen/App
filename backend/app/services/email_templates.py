"""HTML email templates for SkyNet operator emails."""

WELCOME = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:520px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#22d3ee;font-size:18px;font-weight:700;margin:0 0 16px">
    Welcome to {instance_name}</p>
  <p style="margin:0 0 12px">Your operator account has been created by <strong>{actor}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:6px 12px;color:#9ca3af">Login URL</td>
        <td style="padding:6px 12px"><a href="{login_url}" style="color:#22d3ee">{login_url}</a></td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Username</td>
        <td style="padding:6px 12px">{username}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Temp Password</td>
        <td style="padding:6px 12px;font-weight:700;color:#f9fafb">{password}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Role</td>
        <td style="padding:6px 12px;text-transform:capitalize">{role}</td></tr>
    {reset_row}
  </table>
  <p style="color:#ef4444;font-size:13px;font-weight:600;margin:0 0 10px">
    &#9888; Set your own password immediately using the link above — it expires in 24 hours.</p>
  <div style="border:1px solid #374151;border-radius:6px;padding:14px;margin-top:10px;
              background:#0a0a0a;font-size:11px;color:#6b7280;line-height:1.7">
    <strong style="color:#9ca3af;display:block;margin-bottom:6px">
      OPERATOR RESPONSIBILITY &amp; CONFIDENTIALITY NOTICE</strong>
    By accessing this system you confirm that:<br>
    1. You are an authorised operator of {instance_name} and have a legitimate operational need.<br>
    2. All actions performed under your account are logged, attributable to you, and subject to audit.<br>
    3. Visitor data and system intelligence accessed through this platform are strictly confidential
       and must not be shared, exported, or disclosed outside your organisation's authorised channels.<br>
    4. Misuse, unauthorised access, or disclosure of data may result in immediate account suspension
       and legal action under applicable data-protection and computer-misuse laws.<br>
    5. You must report any suspected unauthorised access to your system administrator immediately.<br>
    <strong style="color:#ef4444">Unauthorised access is prohibited and fully monitored.</strong>
  </div>
</div>
"""

FORGOT_RESET = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:520px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#f59e0b;font-size:18px;font-weight:700;margin:0 0 16px">
    Password Reset — {instance_name}</p>
  <p style="margin:0 0 12px">A password reset was requested for your operator account
    (<strong>{username}</strong>).</p>
  <p style="margin:0 0 16px">Click the button below to set a new password.
     This link is valid for <strong>24 hours</strong> and can only be used once.</p>
  <a href="{reset_link}" style="display:inline-block;padding:10px 24px;background:#22d3ee;
     color:#050505;font-weight:700;border-radius:6px;text-decoration:none;margin-bottom:16px">
    Reset my password</a>
  <p style="font-size:11px;color:#6b7280;word-break:break-all;margin:0 0 12px">
    Or copy this link: {reset_link}</p>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #1f2937;padding-top:12px;margin:0">
    If you did not request this reset, ignore this email and contact your administrator.
    Your password will not change unless you click the link above.
  </p>
</div>
"""

ADMIN_RESET = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:520px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#f59e0b;font-size:18px;font-weight:700;margin:0 0 16px">
    Password Reset — {instance_name}</p>
  <p style="margin:0 0 12px">An administrator has reset the password on your account.</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:6px 12px;color:#9ca3af">Login URL</td>
        <td style="padding:6px 12px"><a href="{login_url}" style="color:#22d3ee">{login_url}</a></td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Username</td>
        <td style="padding:6px 12px">{username}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Temp Password</td>
        <td style="padding:6px 12px;font-weight:700;color:#f9fafb">{password}</td></tr>
  </table>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #1f2937;padding-top:12px;margin:0">
    If you did not request this reset, contact your administrator immediately.
  </p>
</div>
"""

TEST = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:520px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#22d3ee;font-size:18px;font-weight:700;margin:0 0 8px">
    SkyNet — SMTP Test</p>
  <p style="color:#6b7280;margin:0">SMTP configuration is working correctly.</p>
</div>
"""

INCIDENT = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:560px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:{accent};font-size:18px;font-weight:700;margin:0 0 14px">
    {instance_name} Incident Alert</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:6px 12px;color:#9ca3af">Severity</td>
        <td style="padding:6px 12px">{severity}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Type</td>
        <td style="padding:6px 12px">{incident_type}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Target</td>
        <td style="padding:6px 12px">{target}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Detected</td>
        <td style="padding:6px 12px">{detected_at}</td></tr>
  </table>
  <p style="margin:0 0 10px">{description}</p>
  <p style="margin:0;color:#6b7280;font-size:12px">
    Review this incident in the SKYNET dashboard and escalate if it remains open.</p>
</div>
"""

OP_ALERT = """
<div style="font-family:monospace;background:#050505;color:#e5e7eb;padding:32px;
            max-width:560px;margin:auto;border:1px solid #1f2937;border-radius:8px">
  <p style="color:#22d3ee;font-size:18px;font-weight:700;margin:0 0 14px">
    {instance_name} Notification</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
    <tr><td style="padding:6px 12px;color:#9ca3af">Event</td>
        <td style="padding:6px 12px">{event_name}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Severity</td>
        <td style="padding:6px 12px">{severity}</td></tr>
    <tr><td style="padding:6px 12px;color:#9ca3af">Target</td>
        <td style="padding:6px 12px">{target}</td></tr>
  </table>
  <p style="margin:0 0 10px">{summary}</p>
  <p style="margin:0;color:#6b7280;font-size:12px">{details}</p>
</div>
"""
