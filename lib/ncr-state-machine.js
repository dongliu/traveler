const StateMachine = require('javascript-state-machine');

function createNcrStateMachine(currentStatus) {
  return new StateMachine({
    init: currentStatus,
    transitions: [
      { name: 'submitDisposition',    from: 'Submitted',            to: 'Dispositioned' },
      { name: 'concurNoApprovers',    from: 'Dispositioned',        to: 'Final Approval' },
      { name: 'concurWithApprovers',  from: 'Dispositioned',        to: 'Approval Requested' },
      { name: 'returnForComment',     from: 'Approval Requested',   to: 'Returned for Comment' },
      { name: 'resubmitToApprovers',  from: 'Returned for Comment', to: 'Approval Requested' },
      // Removing the specific approver whose return-for-comment is blocking
      // the NCR (rather than addressing their comments and resubmitting)
      // should unblock it the same way -- see lib/ncr-service.js's
      // removeApprover.
      { name: 'unblock',              from: 'Returned for Comment', to: 'Approval Requested' },
      { name: 'finalApprove',         from: ['Approval Requested', 'Returned for Comment'], to: 'Final Approval' },
      { name: 'close',                from: 'Final Approval',       to: 'Closed' },
    ],
  });
}

module.exports = { createNcrStateMachine };
