const mongoose = require('mongoose');

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const PreventiveActionSchema = new Schema({
  action_description: String,
  owner_id: String,
  owner_name: String,
  owner_email: String,
  target_completion_date: Date,
  actual_completion_date: Date,
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Completed', 'Overdue'],
  },
  comments: [String],
  status_history: [
    {
      previous_status: String,
      new_status: String,
      changed_by: String,
      changed_timestamp: Date,
    },
  ],
  created_at: Date,
  updated_at: Date,
});

const NCR_EVENT_TYPES = [
  'ncr.submitted',
  'disposition.submitted',
  'delegate.assigned',
  'qa.concurred',
  'approvers.designated',
  'qa.rejected',
  'approval.approved',
  'approval.returned_for_comment',
  'qa.resubmitted',
  'ncr.closed',
  'traveler.signed_off',
  'pa.owner_assigned',
  'pa.status_updated',
  'pa.closed',
  'notification.initial',
  'notification.disposition_request',
  'notification.qa_notification',
  'notification.approval_request',
  'notification.issuance',
  'notification.final_distribution',
  'notification.pa_assigned',
];

const NcrEventSchema = new Schema({
  event_type: { type: String, enum: NCR_EVENT_TYPES },
  actor_type: { type: String, enum: ['user', 'system'] },
  actor_id: String,
  actor_name: String,
  actor_role: String,
  timestamp: { type: Date, required: true },
  previous_status: String,
  new_status: String,
  payload: Schema.Types.Mixed,
  recipients: [
    {
      recipient_id: String,
      recipient_name: String,
      recipient_role: String,
      recipient_role_snapshot: String,
      recipient_email: String,
      delivery_status: String,
      delivery_timestamp: Date,
      error_message: String,
    },
  ],
});

const NCR_STATUSES = [
  'Submitted',
  'Dispositioned',
  'Approved',
  'Returned for Comment',
  'Final Approval',
  'Closed',
];

const NcrSchema = new Schema({
  ncr_number: String,
  originator_id: String,
  originator_name: String,
  creation_timestamp: Date,
  discovery_date: Date,
  discovery_context: {
    type: String,
    enum: ['incoming_inspection', 'in_house_assembly', 'in_house_inspection'],
  },

  part_name: String,
  part_number: String,
  part_revision: String,
  quantity: Number,
  supplier_name: String,
  wbs_number: { type: String, required: true },

  specification_drawing_reference: String,
  po_reference: String,
  description_of_nonconformance: String,

  status: { type: String, enum: NCR_STATUSES },

  traveler_link: {
    traveler_id: ObjectId,
    // this need to be the input unique name
    step_number: Number,
    initiated_from_traveler: Boolean,
  },

  ce_cs_name: String,
  ce_cs_id: String,
  ce_cs_delegate_id: String,

  disposition: {
    parts_disposition: {
      type: String,
      enum: ['Rework', 'Repair', 'Return to Vendor', 'Scrap', 'Use-As-Is'],
    },
    root_cause_documentation: String,
    rework_repair_instructions: String,
    ce_cs_identity: String,
    ce_cs_timestamp: Date,
  },

  preventive_actions: [PreventiveActionSchema],

  qa_staff_identity: String,
  qa_staff_name: String,
  qa_concurrence_timestamp: Date,

  additional_approvers: [
    {
      approver_id: String,
      approver_name: String,
      approver_role: String,
      designated_timestamp: Date,
      approval_status: {
        type: String,
        enum: ['Pending', 'Approved', 'Returned for Comment'],
      },
      approval_timestamp: Date,
      comments: String,
    },
  ],

  closure_record: {
    closed_by: String,
    closed_by_name: String,
    closure_date: Date,
    closure_notes: String,
    closure_timestamp: Date,
    distribution_notification_timestamp: Date,
    disposition_execution_verified: Boolean,
    preventive_actions_verified: Boolean,
    traveler_signed_off: Boolean,
  },

  attachments: [
    {
      file_id: ObjectId,
      file_name: String,
      file_type: String,
      upload_timestamp: Date,
    },
  ],

  events: [NcrEventSchema],

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

NcrSchema.index({ ncr_number: 1 }, { unique: true, sparse: true });
NcrSchema.index({ status: 1 });
NcrSchema.index({ discovery_date: 1 });
NcrSchema.index({ part_number: 1 });
NcrSchema.index({ supplier_name: 1 });
NcrSchema.index({ created_at: 1 });
NcrSchema.index({ 'disposition.parts_disposition': 1 });
NcrSchema.index({ 'events.event_type': 1 });
NcrSchema.index({ 'events.timestamp': 1 });
NcrSchema.index({ 'preventive_actions.status': 1 });
NcrSchema.index({ 'preventive_actions.owner_id': 1 });

const Ncr = mongoose.model('Ncr', NcrSchema);

module.exports = { Ncr, NCR_EVENT_TYPES, NCR_STATUSES };
