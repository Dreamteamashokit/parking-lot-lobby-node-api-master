import express from 'express';
var router = express.Router();
import { DbOperations, commonFunctions } from '../services';
import { ClinicPatient, User } from "../models";

const messages = {
    expired: 'Your link is expired, please get new link by sending "Arrived" sms.'
}

router.get('/:id', async (req, res) => {
    try {
        const patient = await DbOperations.findOne(
            ClinicPatient,
            {
                _id: req.params.id,
                submissionID: null,
            },
            {}, {}
        )
        if(!patient) throw Error(messages.expired);
        const user = await DbOperations.findOne(User, { _id: patient?.patientId }, {}, {})
        const jotformId = await commonFunctions.fetchJotformId(patient?.locationId);
        const params = {
            clientPatientId: patient?._id,
            location_id: patient?.locationId,
            ...(user?.fullNumber ? {phoneNumber: user.fullNumber} : {}),
        };
        const queryString = Object.keys(params).map(key => key + '=' + params[key]).join('&');
        const jotFormUrl = `${process.env.HIPPA_JOT_URL}/${jotformId}?${queryString}`
        return res.redirect(jotFormUrl);
    } catch (err) {
        let html = '<head><style>body{font-family:arial;display:flex;align-items:center;line-height:1.5;justify-content:center;}</style></head>';
        html = `<html>${html}<body><h1>${err?.message || err}</h1></body></html>`
        return res.status(400).send(html)
    }
})

module.exports = router;
