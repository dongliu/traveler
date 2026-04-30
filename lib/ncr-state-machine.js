const StateMachine = require('javascript-state-machine');

function createNcrStateMachine(currentStatus) {
  return new StateMachine({
    init: currentStatus,
    transitions: [
      { name: 'submitDisposition',    from: 'Submitted',            to: 'Dispositioned' },
      { name: 'concurNoApprovers',    from: 'Dispositioned',        to: 'Final Approval' },
      { name: 'concurWithApprovers',  from: 'Dispositioned',        to: 'Approved' },
      { name: 'returnForComment',     from: 'Approved',             to: 'Returned for Comment' },
      { name: 'resubmitToApprovers',  from: 'Returned for Comment', to: 'Approved' },
      { name: 'finalApprove',         from: 'Approved',             to: 'Final Approval' },
      { name: 'close',                from: 'Final Approval',       to: 'Closed' },
    ],
  });
}

module.exports = { createNcrStateMachine };
