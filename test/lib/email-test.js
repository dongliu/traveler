const nodemailer = require('nodemailer');
const sinon = require('sinon');
const config = require('../../config/config');
const logger = require('../../lib/loggers').getLogger();
const email = require('../../lib/email');

require('chai').should();

describe('email', function() {
  let fakeTransport;
  let createTransport;

  beforeEach(function() {
    config.app = {
      smtp_host: 'smtp.example.com',
      smtp_port: 25,
      smtp_ssl: false,
      smtp_tls: true,
      notification_email_address: 'traveler-noreply@example.com',
    };
    fakeTransport = {
      sendMail: sinon.stub().resolves({ accepted: ['a@example.com'] }),
      verify: sinon.stub().resolves(true),
      close: sinon.stub(),
    };
    createTransport = sinon
      .stub(nodemailer, 'createTransport')
      .returns(fakeTransport);
    sinon.stub(logger, 'info');
    sinon.stub(logger, 'error');
  });

  afterEach(function() {
    email.close();
    sinon.restore();
  });

  describe('#init', function() {
    it('should create the transport from config without auth', function() {
      email.init();
      createTransport.calledOnce.should.be.true;
      const options = createTransport.firstCall.args[0];
      options.host.should.equal('smtp.example.com');
      options.port.should.equal(25);
      options.secure.should.be.false;
      options.ignoreTLS.should.be.false;
      options.pool.should.be.true;
      options.maxConnections.should.equal(2);
      options.should.not.have.property('auth');
    });

    it('should reuse the transport across calls', function() {
      email.init();
      email.init();
      createTransport.calledOnce.should.be.true;
    });
  });

  describe('#sendNotification', function() {
    it('should send with sender name and configured from address', async function() {
      const ok = await email.sendNotification({
        subject: 'Hello',
        recipients: 'a@example.com',
        text: 'hi',
      });
      ok.should.be.true;
      const mail = fakeTransport.sendMail.firstCall.args[0];
      mail.from.should.equal(
        '"eTraveler Notification" <traveler-noreply@example.com>'
      );
      mail.to.should.equal('a@example.com');
      mail.subject.should.equal('eTraveler Notification - Hello');
    });

    it('should accept an array of recipients', async function() {
      await email.sendNotification({
        subject: 'Hello',
        recipients: ['a@example.com', 'b@example.com'],
        text: 'hi',
      });
      fakeTransport.sendMail.firstCall.args[0].to.should.deep.equal([
        'a@example.com',
        'b@example.com',
      ]);
    });

    it('should skip sending when recipients is an empty array', async function() {
      const ok = await email.sendNotification({
        subject: 'Hello',
        recipients: [],
        text: 'hi',
      });
      ok.should.be.false;
      fakeTransport.sendMail.called.should.be.false;
    });

    it('should generate text from html when text is omitted', async function() {
      await email.sendNotification({
        subject: 'Hello',
        recipients: 'a@example.com',
        html: '<h1>Title</h1><p>body text</p>',
      });
      const mail = fakeTransport.sendMail.firstCall.args[0];
      mail.text.should.include('TITLE');
      mail.text.should.include('body text');
      mail.text.should.not.include('<h1>');
    });

    it('should use a default subject when none is given', async function() {
      await email.sendNotification({
        recipients: 'a@example.com',
        text: 'hi',
      });
      fakeTransport.sendMail.firstCall.args[0].subject.should.equal(
        'New eTraveler Notification'
      );
    });

    it('should initialize the transport once across sends', async function() {
      await email.sendNotification({
        recipients: 'a@example.com',
        text: 'one',
      });
      await email.sendNotification({
        recipients: 'a@example.com',
        text: 'two',
      });
      createTransport.calledOnce.should.be.true;
      fakeTransport.sendMail.calledTwice.should.be.true;
    });

    it('should log and swallow transport errors', async function() {
      fakeTransport.sendMail.rejects(new Error('connection refused'));
      const ok = await email.sendNotification({
        recipients: 'a@example.com',
        text: 'hi',
      });
      ok.should.be.false;
      logger.error.calledOnce.should.be.true;
    });
  });

  describe('#verify', function() {
    it('should resolve true when the server is reachable', async function() {
      const ok = await email.verify();
      ok.should.be.true;
      fakeTransport.verify.calledOnce.should.be.true;
    });

    it('should resolve false and log when verification fails', async function() {
      fakeTransport.verify.rejects(new Error('timeout'));
      const ok = await email.verify();
      ok.should.be.false;
      logger.error.calledOnce.should.be.true;
    });
  });

  describe('#close', function() {
    it('should close the pool and allow re-initialization', function() {
      email.init();
      email.close();
      fakeTransport.close.calledOnce.should.be.true;
      email.init();
      createTransport.calledTwice.should.be.true;
    });

    it('should be a no-op when no transport exists', function() {
      email.close();
      fakeTransport.close.called.should.be.false;
    });
  });
});
