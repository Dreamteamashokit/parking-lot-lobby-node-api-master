import express from 'express';
var router = express.Router();
import Twilio from 'twilio';
import {commonFunctions, logger} from '../services';
const MessagingResponse = Twilio.twiml.MessagingResponse;
import {TwilioController} from '../controller';
import multer from 'multer';
const upload = multer({limits: { fieldSize: 25 * 1024 * 1024 }, dest: 'public/images/jotform' });

router.get('/',async (req,res) => {
  try {
    return res.status(200).end('Twilio Route....')
  } catch (err) {
    let message =(err && err.message) ? err.message : 'Something went wrong into our system. We will get back to you soonest.'
    return res.status(500).send({status:false, message:message})
  }
})
router.post('/sms', async function(req, res, next) {
  try {
    const twiml = new MessagingResponse();
    let response = await TwilioController.sms(req.body);
    logger.dump({path: 'twillio route: 21', body: req.body, response})
    if(!response) {
      return res.end();
    }
    twiml.message(response);
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  } catch (err) {
    let message =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let statusCode = (err && err.status) ? err.status : 500;
    twiml.message(message);
    res.writeHead(statusCode, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  }
});
router.post('/jotNotification', upload.any(), async function (req, res) {
  try {
    logger.dump({path: 'twillio route: 38', body: req.body})
    console.log('\n req.body:', req.body.submissionID, '\n formID:', req.body.formID);
    if(req.body && req.body.submissionID && req.body.rawRequest) {
      await TwilioController.jotNotification(req.body);
    } else {
      throw Error('Data Missing')
    }
    return res.send('ok');
  } catch (error) {
    logger.error({body: req.body, error: error.message || error})
    console.log('\n jotnotification error:', error.message || error) ;
    return res.status(400).send({error: error.message || error});
  }
})
router.get('/jotform/:locationId', async function (req, res) {
  try {
    const data = await TwilioController.qrAppointment(req.params.locationId);
    if(data?.url) {
      res.redirect(data.url)
    }
    return res.send(data);
  } catch (error) {
    return res.status(400).send({error: error.message || error});
  }
})
router.use(async function (req, res, next) {
  try {
    const authorization = req.header('Authorization');
    if(!authorization) {
      throw new Error(commonFunctions.getErrorMessage('missingAuth'));
    }
    const verifyedTokenDetail = await commonFunctions.verifyToken(req.header('Authorization'));
    if(!verifyedTokenDetail || !verifyedTokenDetail.id) {
      throw new Error(commonFunctions.getErrorMessage("unAuth"));
    }
    verifyedTokenDetail['locationId'] = (req.header('LocationId')) ? req.header('LocationId')  : null;
    req['userData'] = verifyedTokenDetail;
    next()
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    return res.status(500).send({message:message, actualMessage:actualMessage});
  }
})
router.post('/send', async (req,res) => {
  try {
      await commonFunctions.verifyLocationId(req.userData);
      const response = await TwilioController.send(req.body, req.userData)
      logger.dump({path: 'twillio route: 76', body: req.body, response})
      return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('POST') ,  data:response})

  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode, message:message, actualMessage:actualMessage});
  }
})

let twilioRouter = router;
module.exports = twilioRouter;
