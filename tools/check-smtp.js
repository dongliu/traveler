#!/usr/bin/env node
/**
 * Verify the SMTP connection from the runtime environment.
 *
 * Usage:
 *   node tools/check-smtp.js                     # verify connection/handshake only
 *   node tools/check-smtp.js someone@example.com # verify, then send a test message
 *
 * Loads SMTP settings through config/config.js — the same path the app uses —
 * so it also validates the deployed app.json. Exits non-zero on failure.
 */

/* eslint no-console: 0 */

const config = require('../config/config');

config.load();

const email = require('../lib/email');

const recipient = process.argv[2];

function report(step, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}`);
}

async function main() {
  const { app } = config;
  console.log(
    `SMTP config: host=${app.smtp_host} port=${app.smtp_port} ` +
      `ssl=${app.smtp_ssl} tls=${app.smtp_tls} ` +
      `from=${app.notification_email_address}`
  );

  if (!app.smtp_host || !app.smtp_port) {
    report('smtp_host and smtp_port present in app.json', false);
    process.exit(1);
  }
  report('smtp_host and smtp_port present in app.json', true);

  const verified = await email.verify();
  report(
    `connect and handshake with ${app.smtp_host}:${app.smtp_port}`,
    verified
  );
  if (!verified) {
    email.close();
    process.exit(1);
  }

  if (recipient) {
    const sent = await email.sendNotification({
      subject: 'SMTP connection check',
      from: recipient,
      recipients: recipient,
      html:
        '<p>This is a test message from <code>tools/check-smtp.js</code>.</p>' +
        `<p>Sent at ${new Date().toISOString()}.</p>`,
    });
    report(`send test message to ${recipient}`, sent);
    email.close();
    process.exit(sent ? 0 : 1);
  }

  email.close();
  process.exit(0);
}

main().catch(function(error) {
  console.error(error);
  email.close();
  process.exit(1);
});
