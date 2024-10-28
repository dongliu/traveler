const nodemailer = require('nodemailer');
const { convert: htmlToText } = require('html-to-text');

const config = require('../config/config');

// this is a hacking way to test and such code should go to either the test or docker dev environment
if (require.main === module) {
  config.load();
}
const { app } = config;

const transport = nodemailer.createTransport({
  host: app.smtp_host,
  port: app.smtp_port,
  secure: app.smtp_ssl, // upgrade later with STARTTLS
  ignoreTLS: !app.smtp_tls,
});

/**
 *
 * @param {{subject: string | undefined, recipients: string | string[], text: string | undefined, html: string | undefined}} options
 */
function sendNotification({ subject, recipients, text, html }) {
  if (Array.isArray(recipients) && recipients.length === 0) {
    return;
  }

  if (text == null && html != null) {
    text = htmlToText(html);
  }

  transport.sendMail({
    from: 'eTraveler Notification <opserver@mail.pbn.bnl.gov>',
    to: recipients,
    subject:
      subject != null
        ? `eTraveler Notification - ${subject}`
        : 'New eTraveler Notification',
    text,
    html,
  });
}

module.exports = { sendNotification };

// this is a hacking way to test and such code should go to either the test or docker dev environment
if (require.main === module) {
  sendNotification({
    subject: 'Hello!',
    html: "<h1>This is a demo</h1><br/><a href='http://google.com'>Link</a>",
    recipients: 'test@example.com',
  });
}
