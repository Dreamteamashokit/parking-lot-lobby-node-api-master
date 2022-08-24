import { commonFunctions } from '../services';
import express from 'express';
import FormData from "form-data"
var router = express.Router();

router.get('/form/:id/questions', async (req, res) => {
    try {
        const questions = await commonFunctions.getFormQuestions(req.params.id)
        const providers = [];
        for (const key in questions) {
            providers.push(questions[key])
        }
        providers.sort((a, b) => Number(a.order) - Number(b.order))
        return res.status(200).send({ status: true, statusCode: 200, data: { providers } })
    } catch (err) {
        console.log('\n status:', err.status, 'message:', err.message);
        let statusCode = err.status || 500;
        let message = err && err.message ? err.message : 'Something went wrong';
        return res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: {} })
    }
});

router.post('/form/:id/questions', async (req, res) => {
    try {
        const { params, body } = req;
        if (!body.name || !body.text || !body.order || !body.type) {
            throw Error("Missing fields")
        }
        let r = {};
        let d3;
        const qid = body.qid;
        if (body.qid) {
            let question = body
            r['type'] = 'addFormQuestion3';
            r['data'] = {id: params.id, qid, question };
            let formData = new FormData()
            console.log('form data ---')
            for (const key in question) {
                console.log(`question[${key}]`, question[key])
                formData.append(`question[${key}]`, question[key])
            }
            d3 = await commonFunctions.editFormQuestion(params.id, qid, formData)
        } else {
            delete body.qid;
            const questions = [body]
            r['type'] = 'postFormQuestions';
            r['data'] = {id: params.id, questions };
            d3 = await commonFunctions.postFormQuestions(params.id, { questions })
        }
        return res.status(200).send({ status: true, statusCode: 200, r, d3 })
    } catch (err) {
        console.log('\n status:', err.status, 'message:', err.message);
        let statusCode = err.status || 500;
        let message = err && err.message ? err.message : 'Something went wrong';
        return res.status(statusCode).send({ status: false, statusCode: statusCode, message: message, data: {} })
    }
});

router.delete('/form/:id/question/:qid', async (req, res) => {
    try {
        const { params } = req;
        await commonFunctions.deleteFormQuestion(params.id, params.qid);
        return res.status(200).send({ status: true, statusCode: 200 });
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