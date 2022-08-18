import express from 'express';
var router = express.Router();
import {AdminController} from '../controller';
import {commonFunctions} from '../services';
import multer from 'multer';
const upload = multer({ dest: 'public/images/logo' });

router.post('/login', async(req,res) => {
    try {
      let response = await AdminController.login(req.body)
      return res.status(200).send({status:true,statusCode:200,message: "Admin login successfully" ,  data:response})
    } catch (err) {
      console.log('\n status:', err.status , 'message:', err.message);
      let statusCode = err.status || 500;
      let message = err && err.message ? err.message : 'Something went wrong';
      return res.status(statusCode).send({status:false, statusCode:statusCode, message :message , data:{}})
    }
});
router.use(async function (req, res, next) {
    try {
      const authorization = req.header('Authorization');
      if(!authorization) {
        throw {status:401, message:commonFunctions.getErrorMessage('missingAuth')};
      }
      const verifyedTokenDetail = await commonFunctions.verifyToken(req.header('Authorization'));
      if(!verifyedTokenDetail || !verifyedTokenDetail.id) {
        throw {status:401, message:commonFunctions.getErrorMessage("unAuth")};
      }
      console.log("verifyedTokenDetail:", verifyedTokenDetail)
      if(verifyedTokenDetail.type !== 3) {
        throw {status:401, message:commonFunctions.getErrorMessage("unAuth")};
      }
      next();
    } catch (err) {
      let message =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrong');
      let statusCode = (err && err.status) ? err.status : 500;
      return res.status(statusCode).send({status:false, statusCode:statusCode, message:message, data:{}});
    }
})
router.get('/dashboard', async(req,res) => {
  try {
    let response = await AdminController.dashboard() ; // req.userData => admin data
    return res.status(200).send({status:true,statusCode:200,message: "fetch data successfully" ,  data:response})
  } catch (err) {
    let statusCode = err.status || 500;
    let message = err && err.message ? err.message : 'Something went wrong';
    return res.status(statusCode).send({status:false, statusCode:statusCode, message :message , data:{}})
  }
});
router.get("/client-list", async (req,res)=> {
try {
  let response = await AdminController.clientList(req.query); // // req.userData => admin data
  return res.status(200).send({status:true,statusCode:200,message: "fetch data successfully" ,  data:response})
} catch(err) {
  let statusCode = err.status || 500;
  let message = err && err.message ? err.message : 'Something went wrong';
  return res.status(statusCode).send({status:false, statusCode:statusCode, message :message , data:{}})
}
});
router.get("/client-location", async (req,res)=> {
  try {
    let response = await AdminController.clientLocations(req.query); // // req.userData => admin data
    return res.status(200).send({status:true,statusCode:200,message: "fetch data successfully" ,  data:response})
  } catch(err) {
    let statusCode = err.status || 500;
    let message = err && err.message ? err.message : 'Something went wrong';
    return res.status(statusCode).send({status:false, statusCode:statusCode, message :message , data:{}})
  }
});
router.post("/add-twilio-number", async (req,res)=> {
  try {
    let response = await AdminController.addTwilioNumber(req.body); // // req.userData => admin data
    return res.status(200).send({status:true,statusCode:200,message: "update number successfully" ,  data:response})
  } catch(err) {
    let statusCode = err.status || 500;
    let message = err && err.message ? err.message : 'Something went wrong';
    return res.status(statusCode).send({status:false, statusCode:statusCode, message :message , data:{}})
  }
});
router.post('/client-register',upload.single('avatar'), async (req,res, next) => {
  try {
    let response = await AdminController.register(req.body, req.file)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
  } catch (err) {
    console.log('\n error client-register:', err)
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})
router.post('/add-client-location', async (req,res, next) => {
  try {
    let response = await AdminController.addClientLocation(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
  } catch (err) {
    console.log('\n error add-client-location:', err)
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})

router.put('/update-client-status', async (req,res, next) => {
  try {
    let response = await AdminController.updateClientStatus(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    console.log('\n error update-client-status:', err)
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})
router.put('/allow-location-add', async (req,res, next) => {
  try {
    let response = await AdminController.allowLocationAdd(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    console.log('\n error allow-location-add:', err)
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})
router.put('/location-sms-feature', async (req,res, next) => {
  try {
    let response = await AdminController.locationSmsFeature(req.body)
    return res.status(201).send({status:true,statusCode:201, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    console.log('\n error location-sms-feature:', err)
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})
router.get('/clinic-analytics-data', async (req,res, next) => {
  try {
    let response = await AdminController.clinicAnalyticsData(req.query)
    return res.status(201).send({status:true,statusCode:201, message: "fetch data successfully" ,  data:response})
  } catch (err) {
    console.log('\n error clinic-analytics-data:', err)
    let message = err.message || 'Something went wrong';
    let statusCode = err.status || 500;
    res.status(statusCode).send({status:false,statusCode:statusCode, message :message , data:{}})
  }
})



let adminRouter = router;
module.exports = adminRouter;