import express from 'express';
var router = express.Router();
import {commonFunctions} from '../services';
import {CommonController} from '../controller';

router.get('/',async (req,res) => {
  try {
    return res.status(200).end('Common Route....')
  } catch (err) {
    let message =(err && err.message) ? err.message : 'Something went wrong into our system. We will get back to you soonest.'
    return res.status(500).send({status:false, message:message})
  }
})
router.get('/checkIfProvidernotAtDesk', async(req,res) => {
  try {
    const response = await CommonController.checkInProviderNotAtDesk()
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('GET') ,  data:response})
} catch (err) {
  let message =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
  let statusCode = (err && err.status) ? err.status : 500;
  return res.status(statusCode).send({status:false,statusCode:statusCode, message:message});
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
    verifyedTokenDetail['locationId'] = (req.header('LocationId')) ? req.header('LocationId')  : null;
    req['userData'] = verifyedTokenDetail;
    next()
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false, statusCode:statusCode, message:message, actualMessage:actualMessage});
  }
})
router.post('/addQuickResponse', async (req,res) => {
  try {
      const response = await CommonController.addQuickResponse(req.body, req.userData)
      return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('POST') ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode, message:message, actualMessage:actualMessage});
  }
})
router.get('/getQuickResponse', async(req,res) => {
  try {
    const response = await CommonController.getQuickResponse(req.query, req.userData)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('GET') ,  data:response})
} catch (err) {
  let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
  let message = commonFunctions.getErrorMessage('somethingWrong') ; 
  let statusCode = (err && err.status) ? err.status : 500;
  return res.status(statusCode).send({status:false,statusCode:statusCode, message:message, actualMessage:actualMessage});
}
});
router.put('/updateQuickResponse', async (req,res) => {
    try {
        const response = await CommonController.updateQuickResponse(req.body, req.userData)
        return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
    } catch (err) {
      let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
      let message = commonFunctions.getErrorMessage('somethingWrong') ; 
      let statusCode = (err && err.status) ? err.status : 500;
      return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
    }
})
router.delete('/removeQuickResponse/:id', async (req,res) => {
  try {
      const response = await CommonController.removeQuickResponse(req.params, req.userData)
      return res.status(200).send({status:true, message: 'Removed Quick Response' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
  }
})

router.get('/fetchPatientList', async(req,res) => {
    try {
      await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.fetchList(req.query, req.userData)
      return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('GET') ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode, message:message, actualMessage:actualMessage});
  }
}); 
router.get('/fetchPatientChat', async(req,res) => {
    try {
      await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.fetchPatientChat(req.query, req.userData)
      return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('GET') ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode, message:message, actualMessage:actualMessage});
  }
});
router.put('/waitingToCheckIn', async (req,res)=> {
    try {
      await commonFunctions.verifyLocationId(req.userData);
        const response = await CommonController.waitingToCheckIn(req.body, req.userData)
        return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
    } catch (err) {
      let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
      let message = commonFunctions.getErrorMessage('somethingWrong') ; 
      let statusCode = (err && err.status) ? err.status : 500;
      return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
    }
}) 
router.put('/checkInToCheckOut', async (req,res)=> {
    try {
      await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.checkInToCheckOut(req.body, req.userData)
      return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
    } catch (err) {
      let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
      let message = commonFunctions.getErrorMessage('somethingWrong') ; 
      let statusCode = (err && err.status) ? err.status : 500;
      return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
    }
})
router.put('/notifyPatient', async(req,res)=> {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await CommonController.notifyPatient(req.body, req.userData)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
  }
})
router.delete('/removePatient/:id', async (req,res) => {
  try {
    await commonFunctions.verifyLocationId(req.userData);
     const response = await CommonController.removePatient(req.params,req.body,req.userData)
     return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('REMOVE_PATIENT') ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
  }
})

router.put('/updateNoShow',async (req,res)=> {
  try {
    await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.updateNoShow(req.body, req.userData)
      return res.status(200).send({status:true, message: 'update no show' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
  }
})
router.put('/updateDelayForPatient',async (req,res)=> {
  try {
      await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.updateDelayForPatient(req.body, req.userData)
      return res.status(200).send({status:true, message: 'update delay for patient' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
  }
})
router.put('/updateNotes',async (req,res)=> {
  try {
    await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.updateNotes(req.body, req.userData)
      return res.status(200).send({status:true, message: 'update notes for patient' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
  }
})
router.post('/addClient',async (req,res)=> {
  try {
      await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.addClient(req.body, req.userData)
      return res.status(200).send({status:true, message: 'client added successfully' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
  }
})
router.post('/addlocation',async (req,res)=> {
  try {
      const response = await CommonController.addlocation(req.body, req.userData)
      return res.status(200).send({status:true, message: 'location added successfully' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
  }
})
router.get('/fetchlocations',async (req,res)=> {
  try {
      const response = await CommonController.fetchlocations(req.userData)
      return res.status(200).send({status:true, message: 'location added successfully' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
  }
})
router.put('/updatePatientInfo', async(req,res) => {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await CommonController.updatePatientInfo(req.body,req.userData)
    return res.status(200).send({status:true, message: 'patient information updated successfully' ,  data:response})
} catch (err) {
  let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
  let message = commonFunctions.getErrorMessage('somethingWrong') ; 
  let statusCode = (err && err.status) ? err.status : 500;
  return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
}
})

router.put('/backToWaiting', async (req,res)=> {
  try {
    await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.backToWaiting(req.body, req.userData)
      return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:message, actualMessage:actualMessage});
  }
})
router.put('/updateCarLobby', async(req,res) => {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await CommonController.updateCarLobby(req.body,req.userData)
    return res.status(200).send({status:true, message: 'car Lobby updated successfully' ,  data:response})
} catch (err) {
  let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
  let message = commonFunctions.getErrorMessage('somethingWrong') ; 
  let statusCode = (err && err.status) ? err.status : 500;
  return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
}
})

router.get('/fetchFormUploads', async(req,res) => {
  try {
    await commonFunctions.verifyLocationId(req.userData);
    const response = await CommonController.fetchFormUploads(req.query,req.userData)
    return res.status(200).send({status:true, message: 'fetch form uploads successfully' ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
  }
})
router.get('/generatePdf', async(req,res) => {
  try {
    const response = await CommonController.generatePdf(req.query)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('GET') ,  data:response})
} catch (err) {
  let message =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
  let statusCode = (err && err.status) ? err.status : 500;
  return res.status(statusCode).send({status:false,statusCode:statusCode, message:message});
}
}); 

router.get('/getAttachmentFromUrl', async(req,res) => {
  try {
    const response = await CommonController.getAttachmentFromUrl(req.query)
    return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('GET') ,  data:response})
} catch (err) {
  let message =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
  let statusCode = (err && err.status) ? err.status : 500;
  return res.status(statusCode).send({status:false,statusCode:statusCode, message:message});
}
});

router.put('/review-document/:id', async (req,res)=> {
  try {
    await commonFunctions.verifyLocationId(req.userData);
      const response = await CommonController.reviewDocument(req.params, req.userData)
      return res.status(200).send({status:true, message: commonFunctions.getSuccessMessage('PUT') ,  data:response})
  } catch (err) {
    let actualMessage =(err && err.message) ? err.message : commonFunctions.getErrorMessage('somethingWrongElse');
    let message = commonFunctions.getErrorMessage('somethingWrong') ; 
    let statusCode = (err && err.status) ? err.status : 500;
    return res.status(statusCode).send({status:false,statusCode:statusCode,message:actualMessage, actualMessage:message});
  }
}) 

let commonRouter = router;
module.exports = commonRouter;