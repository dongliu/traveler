/**
 * Mailpit API client — see specs/002-playwright-e2e-tests/contracts/mailpit-api.md.
 * Confirmed response shapes against a live Mailpit instance during implementation:
 *   search/messages: { total, messages: [{ ID, From, To:[{Name,Address}], Cc:[{Name,Address}], Subject, Created, Snippet }] }
 *   message:         same shape plus { Text, HTML }
 */

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_INTERVAL_MS = 500;

function createMailpitClient(request, baseUrl) {
  async function clearAll() {
    const res = await request.delete(`${baseUrl}/api/v1/messages`);
    if (!res.ok()) {
      throw new Error(`mailpit clearAll failed: ${res.status()} ${await res.text()}`);
    }
  }

  async function search(query) {
    const res = await request.get(`${baseUrl}/api/v1/search`, { params: { query } });
    if (!res.ok()) {
      throw new Error(`mailpit search failed: ${res.status()} ${await res.text()}`);
    }
    const body = await res.json();
    return body.messages || [];
  }

  async function getMessage(id) {
    const res = await request.get(`${baseUrl}/api/v1/message/${id}`);
    if (!res.ok()) {
      throw new Error(`mailpit getMessage failed: ${res.status()} ${await res.text()}`);
    }
    return res.json();
  }

  /**
   * Polls `search(query)` on a bounded interval instead of a single
   * immediate check or a fixed sleep, since SMTP delivery to Mailpit is
   * asynchronous relative to the browser action that triggered it (see
   * contracts/mailpit-api.md's Retry policy). Returns the first matching
   * message, or throws if none arrives within `timeoutMs`.
   */
  async function waitForMessage(query, { timeoutMs = DEFAULT_TIMEOUT_MS, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const messages = await search(query);
      if (messages.length > 0) return messages[0];
      if (Date.now() >= deadline) {
        throw new Error(`mailpit waitForMessage: no message matched query "${query}" within ${timeoutMs}ms`);
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  function addresses(fieldValue) {
    return (fieldValue || []).map(entry => entry.Address);
  }

  return { clearAll, search, getMessage, waitForMessage, addresses };
}

module.exports = { createMailpitClient };
