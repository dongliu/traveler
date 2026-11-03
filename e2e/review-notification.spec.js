// Feature: form review request email notification
// (specs/006-review-email-notification). The suite does not inspect the
// mail service directly (see README.md), so these tests check the form's
// own reviewNotifications record instead -- the durable, in-app proof that
// a review-request email was attempted and whether it was accepted.
// Persona: primary is the form owner (admin); secondary (bob) is the
// designated reviewer.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { call } = require('./fixtures/api-client');
const { personas } = require('./fixtures/env');
const { useScenarioHooks } = require('./fixtures/scenario');
const {
  createForm,
  submitForReview,
  addReviewRequest,
  submitReviewResult,
} = require('./fixtures/forms');
const { grantRole } = require('./fixtures/roles');

useScenarioHooks(test);

async function getReviewInfo(owner, formId) {
  return (await call(owner, 'GET', `/forms/${formId}/review/json`)).body;
}

async function getReviewerEmail() {
  const user = (
    await call('primary', 'GET', `/users/${personas.secondary.id}/json`)
  ).body;
  if (!user.email) {
    throw new Error(`${personas.secondary.id} has no email on file`);
  }
  return user.email;
}

test.describe('Review request email notification', () => {
  test('assigning an existing reviewer records a successful notification for their email', async () => {
    const reviewerEmail = await getReviewerEmail();
    const form = await createForm('primary', {
      title: `e2e review notification ${runId()}`,
    });
    await grantRole('primary', 'secondary', 'reviewer');
    await submitForReview('primary', form.id);
    await addReviewRequest('primary', form.id, 'secondary');

    const review = await getReviewInfo('primary', form.id);
    expect(review.reviewRequests.map(r => r._id)).toContain(
      personas.secondary.id
    );

    const notifications = review.reviewNotifications || [];
    const sentToReviewer = notifications.filter(
      n => n.recipient === reviewerEmail
    );
    expect(sentToReviewer).toHaveLength(1);
    expect(sentToReviewer[0].success).toBe(true);
    expect(sentToReviewer[0].type).toBe('request');
    expect(sentToReviewer[0].sentOn).toBeTruthy();
  });

  test('a new review round after requested changes sends and records a second notification', async () => {
    const reviewerEmail = await getReviewerEmail();
    const form = await createForm('primary', {
      title: `e2e review re-notify ${runId()}`,
    });
    await grantRole('primary', 'secondary', 'reviewer');
    await submitForReview('primary', form.id);
    await addReviewRequest('primary', form.id, 'secondary');
    await submitReviewResult('secondary', form.id, 'requestChanges');

    await submitForReview('primary', form.id);
    await addReviewRequest('primary', form.id, 'secondary');

    const review = await getReviewInfo('primary', form.id);
    const sentToReviewer = (review.reviewNotifications || []).filter(
      n => n.recipient === reviewerEmail && n.success
    );
    expect(sentToReviewer.length).toBeGreaterThanOrEqual(2);
  });
});
