import bcrypt from 'bcrypt';
import * as Jwt from 'jsonwebtoken';
import moment from 'moment';
import Twilio from 'twilio';
import { User, Message, settingSchema, ClinicPatient, locationSchema } from '../models';
import format from 'string-format';
import DBoperations from './DBoperations';
import sgMail from '@sendgrid/mail';
import * as jotform from 'jotform';
import _ from 'underscore';
import * as fs from 'fs';

import * as PDFDocument from 'html-pdf';
import axios from "axios";

import * as dotenv from 'dotenv';
var mongoose = require('mongoose');
dotenv.config();

if (!process.env.SENDGRID_API_KEY) {
    throw new Error('Missing enviornment variable: SENDGRID_API_KEY');
}
if (!process.env.SENDGRID_MAIL_FROM) {
    throw new Error('Missing enviornment variable: SENDGRID_MAIL_FROM');
}
if (!process.env.WEBSITE_URL) {
    throw new Error('Missing enviornment variable: WEBSITE_URL');
}

if (!process.env.JOT_FORM_KEY) {
    throw new Error('Missing enviornment variable: JOT_FORM_KEY');
}
if (!process.env.JOT_FORM_URL) {
    throw new Error('Missing enviornment variable: JOT_FORM_URL');
}

if(!process.env.BITLY_URL || !process.env.BITLY_TOKEN) {
    throw new Error("Missing bitly configure in env file : BITLY_URL OR BITLY_TOKEN");
}


jotform.options({
    url: process.env.JOT_FORM_URL, 
    debug: true,
    apiKey: process.env.JOT_FORM_KEY
});

const jotformField_needToCheck = ['insuranceCardUpdate']

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

let compareHashPassword = async (plainTextPassword, hash) => {
    return bcrypt.compareSync(plainTextPassword, hash)
}
let createHash = async (plainText) => {
    return bcrypt.hashSync(plainText, 10)
}
const setToken = async function (tokenData) {
    return new Promise((resolve, reject) => {
        try {
            console.log('\n tokenData:', tokenData)
            if (!tokenData.id || !tokenData.type) {
                throw new Error(getErrorMessage("jwtError"));
            }
            let tokenToSend = Jwt.sign(tokenData, process.env.JWT_SECRET_KEY);
            return resolve({ accessToken: tokenToSend });
        } catch (err) {
            return reject(err);
        }
    })
};
const verifyToken = async function (token) {
    return new Promise(async (resolve, reject) => {
        try {
            var decoded = Jwt.verify(token, process.env.JWT_SECRET_KEY);
            return resolve(decoded);
        } catch (err) {
            err.status = 401;
            (err.message && err.message === 'jwt malformed') ? err.message = getErrorMessage("unAuth") : err;
            return reject(err);
        }
    })
}

const getReplyMessage = (type, count = 0, totalCount = 0, businessName = '', userName = '', timer = 0, jotformUrl = '') => {
    try {
        const replyMessages = {
            help: 'Keywords available: "Cancel Appointment" to cancel your place in line, DELAY to notify you will be late, ARRIVED to notify arrival, BLOCK to block, UNBLOCK to unblock, CHANGE to change your name, STATUS for most updated line position',
            change: 'Please text us your first and last name (e.g. Jane Doe).',
            block: `Your number has been blocked for further SMS from ${businessName}. Reply UNBLOCK to unblock it.`,
            alreadyBlock: `Your number is blocked for further SMS from ${businessName}. Please Reply UNBLOCK to unblock it.`,
            unblock: 'Your number has been unblocked. Reply BLOCK to block further SMS',
            cancel: 'You have removed your place in line.',
            delay: 'Your provider has been notified that you will be late.',
            status: `Your line position is [${count} of ${totalCount}]`,
            no_match: 'Keywords available: "Cancel Appointment" to cancel your place in line, DELAY to notify you will be late, ARRIVED to notify arrival, BLOCK to block, UNBLOCK to unblock, CHANGE to change your name, STATUS for most updated line position',
            waiting_new: `Hi. Welcome to ${businessName}. You are now checked in. Your line position is [${count} of ${totalCount}]. Text "STATUS" anytime for updated line position. It looks like we don't have your name in our database. Please text us your first and last time (e.g. Jane Doe).`,
            waiting_existing: `Hi  ${userName}. Welcome to ${businessName}. You are now checked in. Your line position is [${count} of ${totalCount}]. Text "STATUS" anytime for updated line position. We will text you when its your turn. In the meantime, you can relax in your car.`,
            waiting_new_withoutLinePosition: `Hi. Welcome to ${businessName}. You are now checked in. Text "STATUS" anytime for updated line position. It looks like we don't have your name in our database. Please text us your first and last time (e.g. Jane Doe).`,
            waiting_existing_withoutLinePosition: `Hi  ${userName}. Welcome to ${businessName}. You are now checked in. Text "STATUS" anytime for updated line position. We will text you when its your turn. In the meantime, you can relax in your car.`,
            update_name: `Hi ${userName}, Thank you for giving us your name. If there is a misspelling, you can text "CHANGE" to change or correct your name anytime.`,
            getSpotNo: `If you are in a designated parking spot, please text us the spot number (e.g. 1, 2, 3, 4). If there is no spot number, you can just stay put.`,
            checkIn: `We are now ready to see you. Please proceed to the check-in area and your name will be called shortly.`,
            checkOut: `Hi ${userName}! Thanks you,  You're checked out of ${businessName}. Out of a scale from 1-10, how likely would you recommend ${businessName} to a friend.`,
            nextInLine: `You are next in line. We will text you when to come in.`,
            timerMessage: `Your wait is about ${timer} minutes. We will text you when to come in.`,
            already_checkIn: `You have already check In for the day. Use keywords: status or "help me" for more Information`,
            noShowAlert: `receptionist/provider mark you as "no show"`,
            submit_form_with_yes: `${userName}, thank you for signing in to ${businessName}. You are now in line. You will get a text when we are ready to see you.`,
            submit_form_with_no: `${userName}, thank you for signing in to ${businessName}. We first need you to complete your paperwork so we can place you in line. After you complete your paperwork, you will get a text when we are ready to see you. Complete your paperwork by clicking here: ${jotformUrl}`,
            not_submit_paperwork: `${userName}, we have not received your registeration paperwork. Please click on this link to fill in your paperwork ${jotformUrl}`,
            submit_paperwork: `${userName}, thank you for completing your paperwork. you will get a text if we have any other question or when we are ready to see you.`,
            reviewMessage: `Hi ${userName}! , We would appreciate it if you can let us know, how we could have improved your experience : ${jotformUrl}`,
            customReview: `Hi ${userName}! , Thank you please write us a review. ${jotformUrl}`,
            empty: `You have send a empty message. Please write something So that,we can find what you want.`
        }

        return replyMessages[type];
    } catch (err) {
        console.log('\n error in getReplyMessage:', err.message || err);
        return 'Keywords available: ARRIVED to check-IN for the day, CANCEL to cancel your place in line, DELAY to notify you will be late, ARRIVED to notify arrival, BLOCK to block, UNBLOCK to unblock, CHANGE to change your name, STATUS for most updated line position';
    }
}
const getErrorMessage = (type) => {
    try {
        const errors = {
            missingAuth: 'Header parameter is Missing: Authorization',
            missingLocation: 'Header parameter is Missing: LocationId',
            unAuth: 'unauthorized',
            jwtError: 'During generate token found that, Id or Type is missing into payload.',
            somethingWrongElse: 'Something went wrong into our system. We will get back to you soonest.',
            somethingWrong: 'Something went wrong into Our System.Please contact to admin.',
            clinicNotExist: 'Clinic for provided Contact No. not exist into Our System.',
            patientIdNotExist: 'Please provide patient Id.',
            clinicIdNotExist: 'Please provide clinic Id',
            patientNotFound: 'No Data Available into Our system for provided Patient Id',
            clinicNotFound: 'No Data Available into Our System for Provided Clinic location',
            clinicContactNotFound: 'No Messages number allocated to provided Clinic location Id',
            typeInToken: 'Type from auth token not found. Please check that your token is valid.',
            parkingSpotError: 'You have replied a wrong message for parking spot',
            locationUnauth: 'No Data found for LocationId'
        }
        return errors[type];
    } catch (err) {
        return 'Something went wrong into Our System.Please contact to admin.';
    }
}
const getUTCStartEndOfTheDay = () => {
    return new Promise(async (resolve, reject) => {
        try {
            var start = moment.utc().utcOffset('-0500').startOf('day');
            var end = moment.utc().utcOffset('-0500').endOf('day');
            return resolve({ start: start, end: end });
        } catch (err) {
            return reject(err);
        }
    })
}
const checkUserInformation = (userData) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!userData || !userData.id) {
                throw { status: 400, message: getErrorMessage('clinicIdNotExist') };
            }
            if (!userData.type) {
                throw { status: 400, message: getErrorMessage('typeInToken') }
            }
            return resolve(true);
        } catch (err) {
            return reject(err);
        }
    })
}
const getSuccessMessage = (type) => {
    try {
        const success = {
            GET: 'Fetch Data Successfully.',
            POST: 'Insert Data Successfully.',
            PUT: 'Update Data Successfully',
            LOGIN: 'Login Successfully',
            FORGOT: 'Please check you mail box.',
            RESET_PASSWORD: 'Password update Successfully.',
            REMOVE_PATIENT: 'Patient profile remove successfully'
        }
        return success[type];
    } catch (err) {
        return 'Data Fetch Successfully.';
    }
}
const sendTwilioMessage = async (payloadData) => {
    try {
        const state = await new Promise(async (resolve, reject) => {
            try {
                const twillioClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                twillioClient.messages.create({
                    to: payloadData.to,
                    from: payloadData.from,
                    body: payloadData.body,
                })
                    .then(message => {
                        console.log("send twilio message:", message.sid);
                        return resolve(message);
                    })
                    .catch(async (error) => {
                        console.log("\n error in twilio message send:", error.message || error);
                        return reject(error);
                    });
            } catch (err) {
                return reject(err);
            }
        });
        console.log("\n on complete twilio send sms...");
       return Promise.resolve(state);
    } catch (error_1) {
        console.log("\n on error in twilio send sms...", error_1.message || error_1);
        return Promise.reject(error_1);
    }
}
const checkSettingAndUpdateMessage = (checkFor, clinicId, patientData, locationId, jotFormUrl = "") => {
    return new Promise(async (resolve, reject) => {
        try {
            const [clinicSetting, baseUrl] = await Promise.all([
                DBoperations.findOne(settingSchema, { clinicId: clinicId }, {}, {}),
                commonFunctions.getEnvVariable('WEBSITE_URL')
            ])
            const { count, totalCount } = await getCountForWaitingList(clinicId, patientData._id, locationId);
            const firstName = (patientData && patientData.first_name) ? patientData.first_name : '';
            const lastName = (patientData && patientData.last_name) ? patientData.last_name : '';
            const placeHolderValues = {
                order: count,
                totalOrder: totalCount,
                name: firstName + ' ' + lastName,
                business: (clinicSetting && clinicSetting.businessInformation && clinicSetting.businessInformation.companyName) ? clinicSetting.businessInformation.companyName : "Our business",
                reviewLink: `${baseUrl}/review/${locationId}/${patientData._id}`,
                clinicNumber: (clinicSetting && clinicSetting.businessInformation && clinicSetting.businessInformation.companyNumber) ? clinicSetting.businessInformation.companyNumber : "Our office number",
                jotUrl:jotFormUrl
            }
            if (clinicSetting) {
                switch (checkFor) {
                    case 'confirmationAlert':
                        if (clinicSetting.confirmationAlert && clinicSetting.confirmationAlert.is_active && clinicSetting.confirmationAlert.message) {
                            const replacedMessage = format(clinicSetting.confirmationAlert.message, placeHolderValues)
                            return resolve({ status: true, message: replacedMessage, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    case 'checkInAlert':
                        if (clinicSetting.checkInAlert && clinicSetting.checkInAlert.is_active && clinicSetting.checkInAlert.message) {
                            const replacedMessage = format(clinicSetting.checkInAlert.message, placeHolderValues)
                            return resolve({ status: true, message: replacedMessage, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    case 'checkOutAlert':
                        if (clinicSetting.checkOutAlert && clinicSetting.checkOutAlert.is_active && clinicSetting.checkOutAlert.message) {
                            const replacedMessage = format(clinicSetting.checkOutAlert.message, placeHolderValues)
                            return resolve({ status: true, message: replacedMessage, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    case 'noShowAlert':
                        if (clinicSetting.noShowAlert && clinicSetting.noShowAlert.is_active && clinicSetting.noShowAlert.message) {
                            const replacedMessage = format(clinicSetting.noShowAlert.message, placeHolderValues)
                            return resolve({ status: true, message: replacedMessage, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    case 'parkingSpotAlert':
                        if (clinicSetting.parkingSpotAlert && clinicSetting.parkingSpotAlert.is_active && clinicSetting.parkingSpotAlert.message) {
                            const replacedMessage = format(clinicSetting.parkingSpotAlert.message, placeHolderValues)
                            return resolve({ status: true, message: replacedMessage, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    case 'confirmationAlertNew':
                        if (clinicSetting.confirmationAlert && clinicSetting.confirmationAlert.is_active && clinicSetting.confirmationAlert.new_message) {
                            const replacedMessage = format(clinicSetting.confirmationAlert.new_message, placeHolderValues)
                            return resolve({ status: true, message: replacedMessage, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    case 'companyOffAlert':
                        if (clinicSetting.companyOffAlert && clinicSetting.companyOffAlert.is_active && clinicSetting.companyOffAlert.message) {
                            const replacedMessage = format(clinicSetting.companyOffAlert.message, placeHolderValues)
                            return resolve({ status: true, message: replacedMessage, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    case 'reviewLinkAlert':
                        if (clinicSetting.reviewLinkAlert && clinicSetting.reviewLinkAlert.is_active && clinicSetting.reviewLinkAlert.message) {
                            const replacedMessage = format(clinicSetting.reviewLinkAlert.message, placeHolderValues)
                            return resolve({ status: true, message: replacedMessage, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    case 'providerNotAtDeskAlert':
                        if (clinicSetting.providerNotAtDeskAlert && clinicSetting.providerNotAtDeskAlert.is_active) {
                            let replacedMessage = `Please call our office number at : ${placeHolderValues.clinicNumber}`;
                            const certainTime = clinicSetting.providerNotAtDeskAlert.certainTime || 15;
                            if(clinicSetting.providerNotAtDeskAlert.message) {
                                replacedMessage = format(clinicSetting.providerNotAtDeskAlert.message, placeHolderValues)
                            }
                            return resolve({ status: true, message: replacedMessage,certainTime:certainTime, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        } else {
                            return resolve({ status: false, message: null, certainTime:0, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                        }
                    default:
                        return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
                }
            } else {
                return resolve({ status: false, message: null, count: count, totalCount: totalCount, businessName: placeHolderValues.business });
            }
        } catch (err) {
            return reject(err);
        }
    })
}

const getCountForWaitingList = (clinicId = null, patientId = null, locationId = null) => {
    return new Promise(async (resolve) => {
        try {
            if (!clinicId || !patientId || !locationId) {
                return resolve({ count: 0, totalCount: 0 });
            }
            const { start, end } = await getUTCStartEndOfTheDay();
            const payloadClinicPatient = {
                clinicId: clinicId,
                locationId: locationId,
                visitDate: { $gte: new Date(start), $lte: new Date(end) },
                is_block: false,
                isCancel: false,
                inQueue: true
            }
            const existClinicPatient = await DBoperations.getData(ClinicPatient, payloadClinicPatient, { _id: 1, patientId: 1, clinicId: 1 }, { lean: true }, []);
            let count = 0;
            if (existClinicPatient && existClinicPatient.length > 0) {
                for (let i = 0; i < existClinicPatient.length; i++) {
                    if (existClinicPatient[i].patientId.toString() == patientId.toString()) {
                        count = i + 1;
                        break;
                    }
                }
            }
            const totalWaiting = await DBoperations.count(ClinicPatient, payloadClinicPatient);
            return resolve({ count: count, totalCount: (totalWaiting && totalWaiting > 0) ? totalWaiting : 0 });
        } catch (err) {
            console.log('\n err in getCountForWaitingList:', err.message || err);
            return resolve({ count: 0, totalCount: 0 });
        }
    })
}
const updateMessage = (locationId = null, clinicId = null, patientId = null, content = '', type = 2, isTwilio=false) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!locationId || !clinicId || !patientId) {
                throw new Error(getErrorMessage('somethingWrong'));
            }
            const payload = {
                content: content,
                patientId: patientId,
                clinicId: clinicId,
                locationId: locationId,
                type: type,
                twilioSend:isTwilio
            }
            if (type === 2) {
                payload['isReadByAdmin'] = true;
            }
            const response = await DBoperations.saveData(Message, payload);
            if (type === 1) {
                const { start, end } = await getUTCStartEndOfTheDay();
                const patientFortheDay = await DBoperations.findOne(ClinicPatient, {
                    patientId: patientId,
                    locationId: locationId,
                    $or: [{ inQueue: true }, { isCheckIn: true }, { isCheckOut: true }],
                    visitDate: { $gte: new Date(start), $lte: new Date(end) }
                }, {}, { lean: true });
                if (patientFortheDay) {
                    const patientData = await DBoperations.findOne(User, { _id: patientId }, { first_name: 1, last_name: 1, fullNumber: 1 }, { lean: true });
                    let first_name = (patientData && patientData.first_name) ? patientData.first_name : '';
                    let last_name = (patientData && patientData.last_name) ? patientData.last_name : '';
                    let fullNumber = (patientData && patientData.fullNumber) ? patientData.fullNumber : '';
                    let full_name = (first_name) ? `${first_name} ${last_name}` : fullNumber;
                    let message = `${full_name} send ${content} .`;
                    io.sockets.to(`room_${clinicId}`).emit('new-message', { clientId: clinicId, patientId: patientId, message: message, locationId: locationId });
                }
            }
            return resolve(response);
        } catch (err) {
            return reject(err);
        }
    })
}

const initialUpdateMessage = (locationId = null, clinicId = null, patientId = null, content = '', type = 2) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!locationId || !clinicId || !patientId) {
                throw new Error(getErrorMessage('somethingWrong'));
            }
            const payload = {
                content: content,
                patientId: patientId,
                clinicId: clinicId,
                locationId: locationId,
                type: type,
                initial_message:true
            }
            const response = await DBoperations.saveData(Message, payload);
            return resolve(response);
        } catch (err) {
            return reject(err);
        }
    })
}


const sendMail = (toEmail, subject = "", htmlContent = "", istext = false, textContent = "") => {
    return new Promise(async (resolve, reject) => {
        try {
            const msg = {
                to: toEmail,
                from: process.env.SENDGRID_MAIL_FROM, // Use the email address or domain you verified above
                subject: subject,
            };
            if (istext) {
                msg['text'] = textContent;
            } else {
                msg['html'] = htmlContent;
            }
            await sgMail.send(msg);
            return resolve(true);
        } catch (error) {
            return reject(error);
        }
    })
}
const addMinutes = (minutes = 0) => {
    return new Promise(async (resolve, reject) => {
        try {
            var updatedDate = moment.utc().add(minutes, 'minutes').format();
            return resolve({ updatedDate: updatedDate });
        } catch (err) {
            return reject(err);
        }
    })
}
const subtractMinutes = (minutes = 0) => {
    return new Promise(async (resolve, reject) => {
        try {
            var updatedDate = moment.utc().subtract(minutes, 'minutes').format();
            return resolve({ updatedDate: updatedDate });
        } catch (err) {
            return reject(err);
        }
    })
}

const getEnvVariable = (param) => {
    return new Promise((resolve) => {
        if (!process.env[param]) {
            return resolve(null)
        } else {
            return resolve(process.env[param])
        }
    })
}

const getFormQuestions = (formID) => {
    return new Promise(async (resolve, reject) => {
        try {
            const formQuestions = await jotform.getFormQuestions(formID);
            return resolve(formQuestions);
        } catch (err) {
            return reject(err)
        }
    })
}
const createFormSubmission = (formID, submissions) => {
    return new Promise(async (resolve, reject) => {
        try {
            const formSubmissions = await jotform.createFormSubmission(formID, submissions);
            return resolve(formSubmissions);
        } catch (err) {
            console.log('\n createFormSubmission errerrerr:', err)
            return reject(err)
        }
    })
}
const editFormSubmission = (submissionId, submissions) => {
    return new Promise(async (resolve, reject) => {
        try {
            const formSubmissions = await jotform.editSubmission(submissionId, submissions);
            return resolve(formSubmissions);
        } catch (err) {
            console.log('\n createFormSubmission errerrerr:', err)
            return reject(err)
        }
    })
}
const formatDate = (date, formatType) => {
    return new Promise((resolve, reject) => {
        try {
            var updatedDate = moment(date).format(formatType);
            return resolve(updatedDate);
        } catch (err) {
            return reject(err);
        }
    })
}
const IsEmpty = (payload) => {
    return new Promise((resolve) => {
        try {
            if (_.isEmpty(payload)) {
                return resolve(true);
            }
            return resolve(false);
        } catch (err) {
            return resolve(true);
        }
    })
}
const getformatedStartEndDay = (date) => {
    return new Promise(async (resolve, reject) => {
        try {
            var start = moment(new Date(date)).startOf('day');
            var end = moment(new Date(date)).endOf('day');
            return resolve({ start: start, end: end });
        } catch (err) {
            return reject(err);
        }
    })
}
const fetchJotformId = async (locationId = null, formNumber = 1) => {
    const populateQuery = [{
                path: 'jotformId',
                select: {
                    jotformId: 1,
                }
            }];
    const location = await DBoperations.findOne(locationSchema, {_id: mongoose.Types.ObjectId(locationId)}, {}, {})
    .populate(populateQuery).exec();
    return location?.jotformId?.jotformId || '212075810747152'
}
const verifyLocationId = async function (userData) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!userData.locationId) {
                throw new Error(commonFunctions.getErrorMessage('missingLocation'));
            }
            const locationData = await DBoperations.findOne(locationSchema, { _id: userData.locationId }, {}, {});
            if (!locationData) {
                throw new Error('No location found.Please check your location Id.');
            } else if (!locationData.twilioNumber) {
                throw new Error('Contact to Admin for assign a unique messaging number to location.');
            }
            return resolve(locationData);
        } catch (err) {
            err.status = 401;
            (err.message && err.message === 'jwt malformed') ? err.message = getErrorMessage("unAuth") : err;
            return reject(err);
        }
    })
}
const getFormData = (submissionID) => {
    return new Promise(async (resolve, reject) => {
        try {
            const formQuestions = await jotform.getSubmission(submissionID);
            return resolve(formQuestions);
        } catch (err) {
            return reject(err)
        }
    })
}
const fetchFormFieldNeedToCheck = () => {
    return new Promise((resolve) => {
        try {
            return resolve(jotformField_needToCheck);
        } catch (err) {
            return resolve([])
        }
    })
}
const getSubmission = (SID) => {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await jotform.getSubmission(SID);
            const uploadArray = [];
            if (response && response.hasOwnProperty('answers')) {
                for (let [key, value] of Object.entries(response.answers)) {
                    if (value && value.hasOwnProperty('name')) {
                        let fieldName = value.name;
                        let qid = key;
                        //console.log('\n qid:::', qid);
                        switch (fieldName) {
                            case 'insuranceCardUpdate':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;
                            case 'drivingLicenseFront':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;
                            case 'drivingLicenseBack':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;
                            case 'insuranceFront':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;
                            case 'insuranceBack':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;
                            case 'secondaryInsuranceFront':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;
                            case 'secondaryInsuranceBack':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;
                            case 'patientSecondaryInsuranceAdd':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;
                            default:
                                break;
                        }
                    }
                }
            }
            /* case 'signature':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;  
            case 'initials':
                                if (value.answer && value.answer !== 'NO')
                                    uploadArray.push(value.answer);
                                break;*/
            return resolve(uploadArray);
        } catch (err) {
            return reject(err)
        }
    })
}
const saveToPdfFile = (html, submissionID) => {
    return new Promise((resolve, reject) => {
        try {
            PDFDocument.create(html).toStream(function (err, stream) {
                if (err) {
                    return reject(err);
                }
                const folder = `pdf/${submissionID}.pdf`;
                const path = `./public/${folder}`;
                stream.pipe(fs.createWriteStream(path));
                return resolve(folder);
            });

        } catch (err) {
            return reject(err);
        }
    })
}
const shorterUrl = async (longUrl) => {
    try {
        if(!process.env.BITLY_URL || !process.env.BITLY_TOKEN) {
            return Promise.resolve({status:false, message:'Missing bitly basic configuration', short_response:{}});
        }
        const payload = {
            "domain": "bit.ly",
            "long_url": longUrl
        } 
        const url = process.env.BITLY_URL;
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.BITLY_TOKEN}`},
            data: JSON.stringify(payload),
            url,
          };
        const response = await axios(options);
        if(response && response.data)
        return Promise.resolve({status:true, message:'success', short_response:response.data});
        else 
        return Promise.resolve({status:false, message:'not not found', short_response:{}});

    } catch (err){
        console.log("\n error here:", err,"\n\n\n\n")
        const message = err && err.message ? err.message : 'Error in shorter url.';
        return Promise.resolve({status:false, message:message, short_response:{}});
 }
}
const addAdmin = async () => {
    return new Promise(async(resolve)=>{
        try {
            const admin_email = "admin@parkinglotlobby.com";
            const admin_password = "Admin@pll";
            var checkEmailExist = await DBoperations.findOne(User,{email: admin_email, userType:3}, {}, {lean: true} );
            if(!checkEmailExist) {
                const cryptedPassword = await createHash(admin_password);
                const payload = {
                    email: admin_email,
                    password: cryptedPassword,
                    agreeTermCondition:true,
                    first_name: "admin",
                    last_name: "user",
                    userType:3,
                    gender:1
                }
                await DBoperations.saveData(User,payload);
            }
            return resolve(true);
        } catch (err) {
            console.log('error in add admin comman function:', err.message || err);
            return resolve(false);
        }
    })
}
const getWeekMonthYearStartEnd = () => {
    return new Promise(async (resolve, reject) => {
        try {
            var weekStart = moment(new Date()).utc().utcOffset('-0500').startOf('week');
            var weekEnd = moment(new Date()).utc().utcOffset('-0500').endOf('week');

            var monthStart = moment(new Date()).utc().utcOffset('-0500').startOf('month');
            var monthEnd = moment(new Date()).utc().utcOffset('-0500').endOf('month');

            var yearStart = moment(new Date()).utc().utcOffset('-0500').startOf('year');
            var yearEnd = moment(new Date()).utc().utcOffset('-0500').endOf('year');
            
            return resolve({ 
                weekStart: weekStart, weekEnd: weekEnd, 
                monthStart:monthStart, monthEnd:monthEnd,
                yearStart:yearStart, yearEnd:yearEnd
            });
        } catch (err) {
            return reject(err);
        }
    })
}
const commonFunctions = {
    compareHashPassword: compareHashPassword,
    createHash: createHash,
    setToken: setToken,
    verifyToken: verifyToken,
    getReplyMessage: getReplyMessage,
    getErrorMessage: getErrorMessage,
    getUTCStartEndOfTheDay: getUTCStartEndOfTheDay,
    checkUserInformation: checkUserInformation,
    getSuccessMessage: getSuccessMessage,
    sendTwilioMessage: sendTwilioMessage,
    checkSettingAndUpdateMessage: checkSettingAndUpdateMessage,
    getCountForWaitingList: getCountForWaitingList,
    updateMessage: updateMessage,
    initialUpdateMessage:initialUpdateMessage,
    sendMail: sendMail,
    addMinutes: addMinutes,
    getEnvVariable: getEnvVariable,
    getFormQuestions: getFormQuestions,
    createFormSubmission: createFormSubmission,
    editFormSubmission: editFormSubmission,
    formatDate: formatDate,
    IsEmpty: IsEmpty,
    getformatedStartEndDay: getformatedStartEndDay,
    fetchJotformId,
    verifyLocationId,
    getFormData,
    fetchFormFieldNeedToCheck,
    getSubmission,
    saveToPdfFile,
    shorterUrl,
    addAdmin,
    subtractMinutes,
    getWeekMonthYearStartEnd
}


module.exports = commonFunctions;
