import { contactMeta } from '../config/contact';

// ─── Contact step header ──────────────────────────────────────────────────────
//
// The sheet header is rendered by the shell, which cannot see the step's state,
// so the step publishes its challenge to the store for this to read. Split from
// contact.test.ts to keep both files inside the 200-line limit.

describe('step header copy', () => {
  // The header is rendered by the shell, which cannot see the step's state, so
  // the step publishes its challenge to the store for this to read. Getting the
  // channel guard wrong is the failure that matters: both contact steps are the
  // same component, so a leftover email challenge must never caption the phone
  // step with "enter the code we sent to <their email>".
  const sentEmail = { channel: 'email' as const, destination: 'a@b.com' };

  it('promises a code before one is sent', () => {
    expect(contactMeta('email').description).toContain("We'll send");
    expect(contactMeta('phone').description).toContain("We'll send");
  });

  it('names the delivery channel the user picked', () => {
    const meta = contactMeta('phone', { challenge: { channel: 'phone', via: 'whatsapp' } });
    expect(meta.description).toContain('by WhatsApp');
    // Email has no channel choice, so it never gains the clause.
    expect(contactMeta('email', { challenge: { channel: 'email' } }).description).not.toContain('by ');
  });

  it('switches to an instruction once a code is out', () => {
    const meta = contactMeta('email', { challenge: sentEmail, codeLength: 6 });
    expect(meta.description).toBe('Enter the 6-digit code we sent to a@b.com.');
  });

  it('honours the configured code length', () => {
    expect(contactMeta('email', { challenge: sentEmail, codeLength: 4 }).description).toContain(
      '4-digit',
    );
  });

  it('ignores a challenge raised by the OTHER step', () => {
    const meta = contactMeta('phone', { challenge: sentEmail });
    expect(meta.description).toContain("We'll send");
    expect(meta.description).not.toContain('a@b.com');
  });

  it('titles each step the way the web SDK does', () => {
    expect(contactMeta('email').title).toBe('Verify your email');
    expect(contactMeta('phone').title).toBe('Verify your phone number');
  });
});
