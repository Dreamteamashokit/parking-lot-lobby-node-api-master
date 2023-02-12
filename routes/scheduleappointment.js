import express from 'express';
var router = express.Router();
import Twilio from 'twilio';
import {commonFunctions, logger} from '../services';
const MessagingResponse = Twilio.twiml.MessagingResponse;
import {ScheduleAppointmentController} from '../controller';
import multer from 'multer';

const messages = {
    expired: 'Your link is expired, please get new link by sending "Arrived" sms.'
}

router.post('/user', async (req,res) => {
    try {
        let response = await ScheduleAppointmentController.scheduleAppointmentMethod(req.body);
        return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
    } catch (err) {
      let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
      let message = commonFunctions.getErrorMessage('somethingWrong') ; 
      let statusCode = (err && err.status) ? err.status : 500;
      return res.status(statusCode).send({status:false,statusCode:statusCode, message:message, actualMessage:actualMessage});
    }
  })

module.exports = router;
