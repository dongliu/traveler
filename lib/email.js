const nodemailer = require('nodemailer');
const { convert: htmlToText } = require('html-to-text');
const logger = require('./loggers').getLogger();

const config = require('../config/config');

let transport = null;

/**
 * initialize the shared pooled SMTP transport from config.email on first use.
 * The relay accepts mail from the app host without authentication, so no
 * auth option is set.
 * @returns {Transporter} the shared nodemailer transport
 */
function initTransport() {
  if (transport) {
    return transport;
  }

  const { email } = config;
  transport = nodemailer.createTransport({
    host: email.smtp_host,
    port: email.smtp_port,
    secure: email.smtp_ssl,
    ignoreTLS: !email.smtp_tls,
    pool: true,
    maxConnections: 2,
  });
  return transport;
}

/**
 * verify the SMTP connection (DNS, TCP, handshake, STARTTLS when enabled)
 * @returns {Promise<boolean>} true when the server is ready to take messages
 */
async function verify() {
  try {
    await initTransport().verify();
    logger.info(`${config.email.smtp_host} is ready to take messages`);
    return true;
  } catch (error) {
    logger.error(`Error connecting to email server: ${error}`);
    return false;
  }
}

/**
 * Send an email notification to one or more recipients. Errors are logged
 * and never propagated — a mail failure must not break a request.
 *
 * @param {{subject: string | undefined, recipients: string | string[], cc: string | string[] | undefined, text: string | undefined, html: string | undefined}} options
 * @returns {Promise<boolean>} true when the message was accepted by the relay
 */
async function sendNotification({ subject, recipients, from, cc, text, html }) {
  if (Array.isArray(recipients) && recipients.length === 0) {
    return false;
  }

  if (text == null && html != null) {
    text = htmlToText(html);
  }

  try {
    const mail = {
      from:
        from != null
          ? from
          : `"eTraveler Notification" <${config.email.notification_email_address}>`,
      to: recipients,
      subject:
        subject != null
          ? `eTraveler Notification - ${subject}`
          : 'New eTraveler Notification',
      text,
      html,
    };
    if (cc != null) {
      mail.cc = cc;
    }
    const info = await initTransport().sendMail(mail);
    logger.info(`Message sent: ${JSON.stringify(info)}`);
  } catch (error) {
    logger.error(`Error sending email: ${error}`);
    return false;
  }
  return true;
}

/**
 * close the pooled transport and release its connections. The next send or
 * verify re-initializes from config.
 */
function close() {
  if (transport) {
    transport.close();
    transport = null;
  }
}

module.exports = { sendNotification, init: initTransport, verify, close };
