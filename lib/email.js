const nodemailer = require('nodemailer');
const { convert: htmlToText } = require('html-to-text');
const logger = require('./loggers').getLogger();

const config = require('../config/config');

// keep existing behavior when run directly for quick demos/tests
if (require.main === module) {
  config.load();
}
const { app } = config;

let transport = null;
let transportVerified = false;

function initTransport() {
  if (transport) return transport;

  transport = nodemailer.createTransport({
    host: app.smtp_host,
    port: app.smtp_port,
    secure: app.smtp_ssl, // upgrade later with STARTTLS
    ignoreTLS: !app.smtp_tls,
    pool: true,
    maxConnections: 2,
  });
  return transport;
}

async function verify() {
  try {
    await transport.verify();
    transportVerified = true;
    logger.info(`${app.smtp_host} is ready to take messages`);
  } catch (error) {
    logger.error('Error connecting to email server:', error);
  }
}

/**
 * Send an email notification to one or more recipients.
 *
 * @param {{subject: string | undefined, recipients: string | string[], text: string | undefined, html: string | undefined}} options
 */
async function sendNotification({ subject, recipients, text, html }) {
  if (Array.isArray(recipients) && recipients.length === 0) {
    return;
  }

  if (text == null && html != null) {
    text = htmlToText(html);
  }

  try {
    await initTransport();
    const info = await transport.sendMail({
      from: `"eTraveler Notification" <${app.notification_email_address}>`,
      to: recipients,
      subject:
        subject != null
          ? `eTraveler Notification - ${subject}`
          : 'New eTraveler Notification',
      text,
      html,
    });
    logger.info('Message sent: ', info);
  } catch (error) {
    logger.error('Error sending email: ', error);
  }
}

module.exports = { sendNotification, init: initTransport, verify };

// demo invocation when run directly
if (require.main === module) {
  (async () => {
    await sendNotification({
      subject: 'Hello!',
      html: "<h1>This is a demo</h1><br/><a href='http://google.com'>Link</a>",
      recipients: 'test@example.com',
    });
  })();
}
