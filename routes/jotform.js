import { commonFunctions } from '../services';
import express from 'express';
var router = express.Router();

router.get('/form/:id/questions', async (req, res) => {
    try {
        const data = await commonFunctions.getFormQuestions(req.params.id)
        return res.status(200).send({ status: true, statusCode: 200, data })
    } catch (err) {
        console.log('\n status:', err.status, 'message:', err.message);
        let statusCode = err.status || 500;
        let message = err && err.message ? err.message : 'Something went wrong';
        return res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: {} })
    }
});

router.get('/form/:id/questions', async (req, res) => {
    try {
        const data = await commonFunctions.getFormQuestions(req.params.id)
        return res.status(200).send({ status: true, statusCode: 200, data })
    } catch (err) {
        console.log('\n status:', err.status, 'message:', err.message);
        let statusCode = err.status || 500;
        let message = err && err.message ? err.message : 'Something went wrong';
        return res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: {} })
    }
});

router.put('/user/forms', async (req, res) => {
    try {
        const data = await commonFunctions.getForms()
        return res.status(200).send({ status: true, statusCode: 200, data })
    } catch (err) {
        console.log('\n status:', err.status, 'message:', err.message);
        let statusCode = err.status || 500;
        let message = err && err.message ? err.message : 'Something went wrong';
        return res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: {} })
    }
});

router.put('/form/:id/clone', async (req, res) => {
    try {
        const data = await commonFunctions.cloneForm(req.params.id)
        return res.status(200).send({ status: true, statusCode: 200, data })
    } catch (err) {
        console.log('\n status:', err.status, 'message:', err.message);
        let statusCode = err.status || 500;
        let message = err && err.message ? err.message : 'Something went wrong';
        return res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: {} })
    }
});

let jotformRouter = router;
module.exports = jotformRouter;