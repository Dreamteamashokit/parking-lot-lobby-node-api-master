import express from 'express';
var router = express.Router();
import {commonFunctions} from '../services';
import {UserController} from '../controller';
import multer from 'multer';
const upload = multer({ dest: 'public/images/logo' });
/* GET home page. */
router.get('/', function(req, res, next) {
  res.send({ title: 'Parking Lot Lobby' });
});
router.post('/login', async(req,res, next) => {
  try {
    let response = await UserController.login(req.body)
    return res.status(200).send({status:true,statusCode:200,message: commonFunctions.getSuccessMessage('LOGIN') ,  data:response})
  } catch (err) {
    console.log('\n status:', err.status , 'message:', err.message);
    let statusCode = err.status || 500;
    let message = err.message || 'Something went wrong';
    res.status(statusCode).send({status:false, statusCode:statusCode, message :message , data:{}})
  }
});
// For Register a clinic 
router.post('/register',upload.single('avatar'), async (req,res, next) => {
  try {
    let response = await UserController.register(req.body, req.file)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})
router.post('/forgot', async (req,res, next) => {
    try {
      await UserController.forgot(req.body)
      return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('FORGOT')})
    } catch (err) {
      let message = err.message || 'Something went wrong';
      let statusCode = err.status || 500;
      res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
    }
})
router.post('/reset-password', async (req,res, next) => {
  try {
    let response = await UserController.resetPassword(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('RESET_PASSWORD') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})
router.post('/patient-register', async (req,res) => {
  try {
    let response = await UserController.patientRegister(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})

router.post('/add-review', async (req,res) => {
  try {
    let response = await UserController.addReview(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})
router.get('/get-businessDetail', async (req,res) => {
  try {
    console.log('\n get-businessDetail:', req.query);
    let response = await UserController.getBusinessDetail(req.query)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('GET') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})
router.post('/another-patient-register', async (req,res) => {
  try {
    let response = await UserController.anotherPatientRegister(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})

router.post('/save-number', async (req,res) => {
  try {
    let response = await UserController.saveNumber(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})

router.use(async function (req, res, next) {
  try {
    const authorization = req.header('Authorization');
    if(!authorization) {
      throw {status:400, message:commonFunctions.getErrorMessage('missingAuth')}
    }
    const verifyedTokenDetail = await commonFunctions.verifyToken(req.header('Authorization'));
    if(!verifyedTokenDetail || !verifyedTokenDetail.id) {
      throw {status:401, message:commonFunctions.getErrorMessage('unAuth')}
    }
    verifyedTokenDetail['locationId'] = (req.header('LocationId')) ? req.header('LocationId')  : null;
    req['userData'] = verifyedTokenDetail;
    next();
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = err.status || 500;
    return res.status(statusCode).send({status:false, statusCode:statusCode, message:actualMessage, actualMessage:message});
  }
}) 
router.get('/settings', async (req,res, next) => {
  try {
    let response = await UserController.settings(req.userData)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('GET') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})
router.post('/updateBusinessInformation',upload.single('avatar'), async (req,res, next) => {
  try {
    let response = await UserController.updateBusinessInformation(req.body, req.userData, req.file)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})
router.post('/scheduleInformation', async (req,res, next) => {
  try {
    await UserController.scheduleInformation(req.body, req.userData);
    let response = await UserController.settings(req.userData);
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})
router.post('/updateAlertSettings', async (req,res, next) => {
  try {
    let response = await UserController.updateAlertSettings(req.body, req.userData)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})
router.get('/plan', async (req, res) => {
  try {
    let response = await UserController.plan(req.userData)
    return res.status(200).send({ status: true, data: response })
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: err })
  }
})
router.post('/updateCard', async (req, res) => {
  try {
    let response = await UserController.cardUpdate(req.body, req.userData)
    return res.status(200).send({ status: true, data: response })
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: err })
  }
})
router.post('/pay/membership', async (req, res) => {
  try {
    let response = await UserController.payMembership(req.userData, req.body)
    return res.status(200).send({ status: true, data: response })
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: err })
  }
})
router.get('/pay/cards', async (req, res) => {
  try {
    let response = await UserController.getCards(req.userData)
    return res.status(200).send({ status: true, data: response })
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: err })
  }
})
router.post('/pay/card', async (req, res) => {
  try {
    let response = await UserController.addCard(req.body, req.userData)
    return res.status(200).send({ status: true, data: response })
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: err })
  }
})
router.delete('/pay/card/:source', async (req, res) => {
  try {
    let response = await UserController.removeCard(req.params, req.userData)
    return res.status(200).send({ status: true, data: response })
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: err })
  }
})
router.post('/updateAdditionalSettings', async (req,res, next) => {
  try {
    let response = await UserController.updateAdditionalSettings(req.body, req.userData)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})
router.post('/updateStylingSettings', async (req,res, next) => {
  try {
    let response = await UserController.updateStylingSettings(req.body, req.userData)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})
router.post('/updateclientInformationSettings', async (req,res, next) => {
  try {
    let response = await UserController.updateclientInformationSettings(req.body, req.userData)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})
router.get('/getNotifications', async (req,res, next) => {
  try {
    let response = await UserController.getNotifications(req.userData)
    return res.status(200).send({status:true, message: 'fetch notifications successfully.' ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})
router.put('/markMessageRead', async(req,res)=> {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await UserController.markMessageRead(req.body, req.userData)
    return res.status(200).send({status:true, message: 'mark message read for selected patient' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
  }
})
router.put('/markAllMessageRead', async(req,res)=> {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await UserController.markAllMessageRead(req.body, req.userData)
    return res.status(200).send({status:true, message: 'mark all message read' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
  }
})
router.put('/updatePatientInfo', async(req,res)=> {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await UserController.updatePatientInfo(req.body, req.userData);
    return res.status(200).send({status:true, message: 'update information Successfully' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
  }
})
router.get('/visitor-list', async (req,res) => {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await UserController.visitorList(req.query, req.userData);
    return res.status(200).send({status:true, message: 'fetch data Successfully' ,  data:response})
  } catch (err) {
    let message =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:message});
  }
})
router.get('/visitor-reviews', async (req,res) => {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await UserController.visitorReviews(req.query,req.userData);
    return res.status(200).send({status:true, message: 'fetch data Successfully' ,  data:response})
  } catch (err) {
    let message =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:message});
  }
})
router.post('/updateSignageInformation',upload.single('avatar'), async (req,res, next) => {
  try {
    let response = await UserController.updateSignageInformation(req.body, req.userData, req.file)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})

router.put('/updateIsOpenSetting',async (req,res, next) => {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    let response = await UserController.updateIsOpenSetting(req.body, req.userData)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:err})
  }
})

let userRouter = router;
module.exports = userRouter;
