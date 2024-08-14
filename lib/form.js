const debug = require('debug')('traveler:lib:form');
const mongoose = require('mongoose');

const config = require('../config/config');
// const auth = require('./auth');

const authConfig = config.auth;

const reqUtils = require('./req-utils');

const FormContent = mongoose.model('FormContent');
const ReleasedForm = mongoose.model('ReleasedForm');


async function releaseForm(req, res) {
    // if the base form is normal then load the released discrepancy form
    debug(req.body.discrepancyFormId);
    debug(req[req.params.id].formType);
    if (
      req[req.params.id].formType === 'normal' &&
      req.body.discrepancyFormId
    ) {
      reqUtils.existSource('discrepancyFormId', 'body', ReleasedForm)(
        req,
        res,
        // next
      );
    }

    // check the discrepancy form type
    debug(req[req.body.discrepancyFormId]);
    if (
      req[req.body.discrepancyFormId] &&
      req[req.body.discrepancyFormId].formType !== 'discrepancy'
    ) {
      return res
        .status(400)
        .send(
          `${req[req.body.discrepancyFormId].id} is not a discrepancy form`
        );
    }

    if (
      req[req.body.discrepancyFormId] &&
      req[req.body.discrepancyFormId].status !== 1
    ) {
      return res
        .status(400)
        .send(`${req[req.body.discrepancyFormId].id} is not released`);
    }

    const form = req[req.params.id];
    const discrepancyForm = req[req.body.discrepancyFormId];

    // update the form status
    form.status = 1;
    form.updatedBy = req.session.userid;
    form.updatedOn = Date.now();
    form.incrementVersion({force: true});
    await form.save();

    const releasedForm = {};

    releasedForm.title = req.body.title || form.title;
    releasedForm.description = req.body.description || form.description;
    releasedForm.tags = form.tags;
    releasedForm.formType = form.formType;
    releasedForm.base = new FormContent(form);
    releasedForm.ver = `${releasedForm.base._v}`;
    releasedForm.documentNumber = form.documentNumber;
    if (discrepancyForm) {
        // update formType
        releasedForm.formType = 'normal_discrepancy';
        releasedForm.discrepancy = discrepancyForm.base;
        releasedForm.ver += `:${discrepancyForm.base._v}`;
    }
    releasedForm.releasedBy = req.session.userid;
    releasedForm.releasedOn = Date.now();

    // check if there is already a released form with the same name and
    // version
    try {
        const existingForm = await ReleasedForm.findOne({
            title: releasedForm.title,
            formType: releasedForm.formType,
            ver: releasedForm.ver,
            // only search the active released form, not archived
            // remove this condition if including the archive released form
            status: 1,
        });
        debug(`find existing form: ${existingForm}`);
        if (existingForm) {
            return res
                .status(400)
                .send(
                    `A form with same title, type, and version was already released in ${existingForm._id}.`
                );
        }
        const saveForm = await new ReleasedForm(releasedForm).saveWithHistory(
            req.session.userid
        );


        // close the review requests
        await form.closeReviewRequests();
        const url = `${req.proxied ? authConfig.proxied_service : authConfig.service
            }/released-forms/${saveForm._id}/`;
        return res.status(201).json({
            location: url,
        });
    } catch (error) {
        return res.status(500).send(error.message);
    }
}

module.exports = {
    releaseForm
}