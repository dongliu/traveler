const StateMachine = require('javascript-state-machine');

function createNcrStateMachine(currentStatus) {
  return new StateMachine({
    init: currentStatus,
    transitions: [
      { name: 'submitDisposition',    from: 'Submitted',            to: 'Dispositioned' },
      { name: 'concurNoApprovers',    from: 'Dispositioned',        to: 'Final Approval' },
      { name: 'concurWithApprovers',  from: 'Dispositioned',        to: 'Approval Requested' },
      { name: 'reject',               from: 'Dispositioned',        to: 'Rejected' },
      // A Return for Comment decision stops the round outright -- it does not
      // block pending the same round resuming; QA decides what happens next
      // from Dispositioned (spec 129). There is deliberately no transition
      // back into 'Approval Requested' from here.
      { name: 'returnForComment',     from: 'Approval Requested',   to: 'Dispositioned' },
      { name: 'finalApprove',         from: 'Approval Requested',   to: 'Final Approval' },
      { name: 'close',                from: 'Final Approval',       to: 'Closed' },
    ],
  });
}

module.exports = { createNcrStateMachine };
