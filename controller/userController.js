import {User, Message,ClinicPatient,settingSchema, locationSchema, reviewSchema} from '../models';
import {DbOperations, commonFunctions} from '../services';

import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.HIPPA_JOT_URL) {
    throw new Error('Missing enviornment variable: HIPPA_JOT_URL');
}

var mongoose = require('mongoose');

class UserController {
    static async login(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData) {
                    throw {status:400, message:"Missing Require Parameter's."};
                } 
                if(!payloadData.email) {
                    throw {status:400, message:'Missing Require Parameter:email.'}
                } 
                if(!payloadData.password) {
                    throw {status:400, message:'Missing Require Parameter:password.'}
                }
                var checkEmailExist = await DbOperations.findOne(User,{email: payloadData.email, userType:1}, {}, {lean: true} );
                if(!checkEmailExist) {
                    throw {status:404, message:'email not exist into system. Please check your email.'};
                }
                let checkPassword = await commonFunctions.compareHashPassword(payloadData.password, checkEmailExist.password)
                if(!checkPassword) {
                    throw {status:403, message:'Incorrect password'};
                }
                if(!checkEmailExist.status) {
                    throw {status:402, message:'This account is currently deactive.Please contact to Admin.'};
                }

                let loginTime = (+new Date())
                let tz = Math.floor((Math.random() * 10000) + 10000);
                let tokenData = {
                    id: checkEmailExist._id,
                    loginTime: loginTime,
                    random: tz,
                    type: checkEmailExist.userType || 1
                };
                delete checkEmailExist.password;
                delete checkEmailExist.__v;
                let [token,default_location] = await Promise.all([
                    commonFunctions.setToken(tokenData),
                    DbOperations.findOne(locationSchema, {clinicId: checkEmailExist._id, isActive:true, isDefault:true}, {_id:1})
                ])
                checkEmailExist.accessToken = token.accessToken;
                checkEmailExist.default_location = (default_location && default_location._id) ? default_location._id : null;
                return resolve(checkEmailExist);
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async register(payloadData, fileData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData) {
                    throw new Error("Missing Require Parameter's.")
                } 
                if(!payloadData.email) {
                    throw new Error('Missing Require Parameter:email.')
                } 
                if(!payloadData.password) {
                    throw new Error('Missing Require Parameter:password.')
                }
                if(!payloadData.agreeTermCondition) {
                    throw new Error('Please mark agreeTermCondition checkBox.')
                }
                if(!payloadData.businessName) {
                    throw new Error('Missing Require Parameter:businessName')
                }
                if(!payloadData.locationNumber) {
                    throw new Error('Missing Require Parameter:locationNumber')
                }
                if(!payloadData.fullNumber) {
                    throw new Error('Missing Require Parameter:fullNumber')
                }
                if(!payloadData.selectedTimeZone) {
                    throw new Error('Missing Require Parameter:selectedTimeZone')
                }
                let criteria = {email: payloadData.email};
                const checkEmailExist = await DbOperations.findOne(User,criteria, {}, {} );
                if(checkEmailExist) {
                    throw new Error('Provided email already exist into system. Please change email and try again.')
                }
                const cryptedPassword = await commonFunctions.createHash(payloadData.password);
                const payload = {
                    email: payloadData.email,
                    password: cryptedPassword,
                    agreeTermCondition: payloadData.agreeTermCondition,
                    userType:1,
                }
                let response = await DbOperations.saveData(User,payload);
                const settingPayload = {
                    businessInformation: {
                        companyName : payloadData.businessName,
                        companyNumber:payloadData.fullNumber,
                        timeZone: JSON.parse(payloadData.selectedTimeZone),
                        locationNumber : payloadData.locationNumber
                    },
                    clinicId:response._id
                }
                if(fileData && fileData.hasOwnProperty('filename')) {
                    settingPayload.businessInformation['logo'] = fileData.filename;
                }
                let settings = await DbOperations.saveData(settingSchema,settingPayload);
                return resolve({user:response, settings:settings});
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async forgot(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData.email) {
                    throw {status:400, message:'Missing Require Parameter:email.'}
                }
                var checkEmailExist = await DbOperations.findOne(User,{email: payloadData.email}, {}, {lean: true} );
                if(!checkEmailExist) {
                    throw {status:404, message:'email not exist into system. Please check your email.'};
                }
                const tokenString = `${checkEmailExist._id}_payloadData.email` ;
                const cryptedToken = await commonFunctions.createHash(tokenString);
                const emailSubject = 'Rest Password Email';
                const htmlContent = `<div>Hi,<br /><strong>Please click below link to update your password</strong><br /><a href="${process.env.WEBSITE_URL}/reset-password?token=${cryptedToken}" ><strong>Click Here</strong></a><br />Thanks"</div>`;
                const [sendEmail, updateToken] = await Promise.all([
                    commonFunctions.sendMail(payloadData.email, emailSubject,htmlContent),
                    DbOperations.findAndUpdate(User,{_id: checkEmailExist._id},{forgotToken: cryptedToken}, {new: true})
                ])
                return resolve(updateToken);
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async resetPassword(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData.password) {
                    throw {status:400, message:'Missing Require Parameter:password.'}
                }
                if(!payloadData.repeatPassword) {
                    throw {status:400, message:'Missing Require Parameter:repeatPassword.'}
                }
                if(!payloadData.resetToken) {
                    throw {status:400, message:'Missing Require Parameter:resetToken.'}
                }
                var checkTokenExist = await DbOperations.findOne(User,{forgotToken: payloadData.resetToken}, {}, {lean: true} );
                if(!checkTokenExist) {
                    throw {status:404, message:'Provided token not exist into system. Please contact to Admin.'};
                }

                if(payloadData.password !== payloadData.repeatPassword) {
                    throw {status:400, message:'Password & Repeat Password are not same.'};
                }

                const cryptedPassword = await commonFunctions.createHash(payloadData.password);
                const updateResponse = await DbOperations.findAndUpdate(User,{_id: checkTokenExist._id},{forgotToken: '', password: cryptedPassword}, {new: true})
                return resolve(updateResponse);
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async settings(userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                const criteria = {clinicId:userData.id};
                let response = await DbOperations.findOne(settingSchema,criteria, {}, {} );
                let response2 = await DbOperations.findOne(locationSchema, {_id: userData.locationId}, {openingTime: 1, isOpen: 1, closingTime: 1, isScheduleOpen: 1, isScheduleClose: 1, selectedTimeZone: 1, twilioNumber: 1}, {});    
                return resolve({...response?.toJSON(), scheduleInformation: response2?.toJSON()});
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async updateBusinessInformation(payloadData ,userData, fileData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                if(!payloadData.companyName) {
                    throw {status:400, message:'Missing Required Parameter: companyName'}
                }
                if(!payloadData.companyAddress) {
                    throw {status:400, message:'Missing Required Parameter: companyAddress'}
                }
                if(!payloadData.companyNumber) {
                    throw {status:400, message:'Missing Required Parameter: companyNumber'}
                }
                const criteria = {clinicId:userData.id};
                const QuerypayLoad ={
                    businessInformation : {
                        companyName:payloadData.companyName,
                        companyAddress:payloadData.companyAddress,
                        companyNumber: payloadData.companyNumber
                    }
                };
                if(payloadData.selectedTimeZone) {
                    QuerypayLoad.businessInformation['timeZone'] = JSON.parse(payloadData.selectedTimeZone);
                }
                if(payloadData.selectedLanguage) {
                    QuerypayLoad.businessInformation['language'] = JSON.parse(payloadData.selectedLanguage);
                }
                if(fileData && fileData.hasOwnProperty('filename')) {
                    QuerypayLoad.businessInformation['logo'] = fileData.filename;
                }
                const response = await DbOperations.findOne(settingSchema,criteria, {}, {} );
                if(response) {
                    const updateResponse = await DbOperations.findAndUpdate(settingSchema,criteria,QuerypayLoad, {new: true});                
                    return resolve(updateResponse);
                } else {
                    QuerypayLoad['clinicId'] = userData.id;
                    let InsertResponse = await DbOperations.saveData(settingSchema,QuerypayLoad);
                    return resolve(InsertResponse);
                }
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async updateAlertSettings(payloadData ,userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                if(!payloadData.confirmationAlert) {
                    throw {status:400, message:'Missing Required Parameter: confirmationAlert'}
                } else if(payloadData.confirmationAlert.is_active && !payloadData.confirmationAlert.message) {
                    throw {status:400, message:'Missing Required Parameter: message for confirmation'}
                } else if(payloadData.confirmationAlert.is_active && !payloadData.confirmationAlert.new_message) {
                    throw {status:400, message:'missing new patient message for confirmation'}
                } 

                if(!payloadData.nextInLineAlert) {
                    throw {status:400, message:'Missing Required Parameter: nextInLineAlert'}
                } else if(payloadData.nextInLineAlert.is_active && !payloadData.nextInLineAlert.message) {
                    throw {status:400, message:'Missing Required Parameter : message for nextInLine'}
                }

                if(!payloadData.checkInAlert) {
                    throw {status:400, message:'Missing Required Parameter: checkInAlert'}
                } else if(payloadData.checkInAlert.is_active && !payloadData.checkInAlert.message) {
                    throw {status:400, message:'Missing Required Parameter : message for checkIn'}
                }

                if(!payloadData.checkOutAlert) {
                    throw {status:400, message:'Missing Required Parameter: checkOutAlert'}
                } else if(payloadData.checkOutAlert.is_active && !payloadData.checkOutAlert.message) {
                    throw {status:400, message:'Missing Required Parameter : message for checkOut'}
                }

                if(!payloadData.noShowAlert) {
                    throw {status:400, message:'Missing Required Parameter: noShowAlert'}
                } else if(payloadData.noShowAlert.is_active && !payloadData.noShowAlert.message) {
                    throw {status:400, message:'Missing Required Parameter : message for noShow'}
                }

                if(!payloadData.parkingSpotAlert) {
                    throw {status:400, message:'Missing Required Parameter: parkingSpotAlert'}
                } else if(payloadData.parkingSpotAlert.is_active && !payloadData.parkingSpotAlert.message) {
                    throw {status:400, message:'Missing Required Parameter : message for parkingSpot'}
                }

                if(!payloadData.companyOffAlert) {
                    throw {status:400, message:'Missing Required Parameter: companyOffAlert'}
                } else if(payloadData.companyOffAlert.is_active && !payloadData.companyOffAlert.message) {
                    throw {status:400, message:'Missing Required Parameter : message for companyOffAlert'}
                }

                if(!payloadData.reviewLinkAlert) {
                    throw {status:400, message:'Missing Required Parameter: reviewLinkAlert'}
                } else if(payloadData.reviewLinkAlert.is_active && !payloadData.reviewLinkAlert.message) {
                    throw {status:400, message:'Missing Required Parameter : message for reviewLinkAlert'}
                }
                if(!payloadData.providerNotAtDeskAlert) {
                    throw {status:400, message:'Missing Required Parameter: providerNotAtDeskAlert'}
                } else if(payloadData.providerNotAtDeskAlert.is_active && !payloadData.providerNotAtDeskAlert.message) {
                    throw {status:400, message:'Missing Required Parameter : message for providerNotAtDeskAlert'}
                } else if(!payloadData.providerNotAtDeskAlert.certainTime || (isNaN(parseInt(payloadData.providerNotAtDeskAlert.certainTime)))) {
                    throw {status:400, message:'Please provide a time in minutes for Provider not at Desk.'}
                }

                const criteria = {clinicId:userData.id};
                const QuerypayLoad ={
                    confirmationAlert:{
                        is_active: (payloadData.confirmationAlert.is_active) ? payloadData.confirmationAlert.is_active : false,
                        message: payloadData.confirmationAlert.message,
                        new_message: payloadData.confirmationAlert.new_message
                    },
                    nextInLineAlert:{
                        is_active:(payloadData.nextInLineAlert.is_active) ? payloadData.nextInLineAlert.is_active : false,
                        message:payloadData.nextInLineAlert.message
                    },
                    checkInAlert:{
                        is_active:(payloadData.checkInAlert.is_active) ? payloadData.checkInAlert.is_active : false,
                        message:payloadData.checkInAlert.message
                    },
                    checkOutAlert:{
                        is_active:(payloadData.checkOutAlert.is_active) ? payloadData.checkOutAlert.is_active : false,
                        message:payloadData.checkOutAlert.message
                    },
                    noShowAlert:{
                        is_active:(payloadData.noShowAlert.is_active) ? payloadData.noShowAlert.is_active : false,
                        message:payloadData.noShowAlert.message
                    },
                    parkingSpotAlert:{
                        is_active:(payloadData.parkingSpotAlert.is_active) ? payloadData.parkingSpotAlert.is_active : false,
                        message:payloadData.parkingSpotAlert.message
                    },
                    companyOffAlert:{
                        is_active:(payloadData.companyOffAlert.is_active) ? payloadData.companyOffAlert.is_active : false,
                        message:payloadData.companyOffAlert.message
                    },
                    reviewLinkAlert:{
                        is_active:(payloadData.reviewLinkAlert.is_active) ? payloadData.reviewLinkAlert.is_active : false,
                        message:payloadData.reviewLinkAlert.message
                    },
                    providerNotAtDeskAlert:{
                        is_active:(payloadData.providerNotAtDeskAlert.is_active) ? payloadData.providerNotAtDeskAlert.is_active : false,
                        message:payloadData.providerNotAtDeskAlert.message,
                        certainTime: payloadData.providerNotAtDeskAlert.certainTime
                    }
                    
                };
                const response = await DbOperations.findOne(settingSchema,criteria, {}, {} );
                if(response) {
                    const updateResponse = await DbOperations.findAndUpdate(settingSchema,criteria,QuerypayLoad, {new: true});                
                    return resolve(updateResponse);
                } else {
                    QuerypayLoad['clinicId'] = userData.id;
                    let InsertResponse = await DbOperations.saveData(settingSchema,QuerypayLoad);
                    return resolve(InsertResponse);
                }
            } catch (err) {
                return reject(err);
            }
        })
        
    } 
    static async updateAdditionalSettings(payloadData ,userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                const criteria = {clinicId:userData.id};
                const QuerypayLoad ={
                    desktopAdditional:{
                        is_active:(payloadData.desktopAdditional.is_active) ? payloadData.desktopAdditional.is_active : false,
                        is_timer:(payloadData.desktopAdditional.is_timer) ? payloadData.desktopAdditional.is_timer : false,
                        is_exit:(payloadData.desktopAdditional.is_exit) ? payloadData.desktopAdditional.is_exit : false,
                        is_checkIn:(payloadData.desktopAdditional.is_checkIn) ? payloadData.desktopAdditional.is_checkIn : false,
                        is_delayed:(payloadData.desktopAdditional.is_delayed) ? payloadData.desktopAdditional.is_delayed : false,
                    },
                    inforClientPositionLine:(payloadData.inforClientPositionLine) ? payloadData.inforClientPositionLine : false,
                    clientIncomplete:(payloadData.clientIncomplete) ? payloadData.clientIncomplete : false,
                    statusSetting: {
                        isSendStatus:(payloadData.statusSetting.isSendStatus) ? payloadData.statusSetting.isSendStatus : false,
                        sendStatusTime: (payloadData.statusSetting.sendStatusTime) ? payloadData.statusSetting.sendStatusTime : 0
                    }
                };
                const response = await DbOperations.findOne(settingSchema,criteria, {}, {} );
                if(response) {
                    const updateResponse = await DbOperations.findAndUpdate(settingSchema,criteria,QuerypayLoad, {new: true});                
                    return resolve(updateResponse);
                } else {
                    QuerypayLoad['clinicId'] = userData.id;
                    let InsertResponse = await DbOperations.saveData(settingSchema,QuerypayLoad);
                    return resolve(InsertResponse);
                }
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async updateStylingSettings(payloadData ,userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                const criteria = {clinicId:userData.id};
                const QuerypayLoad ={
                    stylingScreen:(payloadData.stylingScreen) ? payloadData.stylingScreen : false
                };
                const response = await DbOperations.findOne(settingSchema,criteria, {}, {} );
                if(response) {
                    const updateResponse = await DbOperations.findAndUpdate(settingSchema,criteria,QuerypayLoad, {new: true});                
                    return resolve(updateResponse);
                } else {
                    QuerypayLoad['clinicId'] = userData.id;
                    let InsertResponse = await DbOperations.saveData(settingSchema,QuerypayLoad);
                    return resolve(InsertResponse);
                }
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async updateclientInformationSettings(payloadData ,userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                if(!payloadData.clientInformation) {
                    throw {status:400, message:'Missing required Parameter: clientInformation'}
                }
                const criteria = {clinicId:userData.id};
                const QuerypayLoad ={
                    clientInformation:{
                        name:(payloadData.clientInformation.name) ? payloadData.clientInformation.name : false,
                        is_required:(payloadData.clientInformation.is_required) ? payloadData.clientInformation.is_required : false,
                        firstLastName:(payloadData.clientInformation.firstLastName) ? payloadData.clientInformation.firstLastName : false
                    }
                };
                const response = await DbOperations.findOne(settingSchema,criteria, {}, {} );
                if(response) {
                    const updateResponse = await DbOperations.findAndUpdate(settingSchema,criteria,QuerypayLoad, {new: true});                
                    return resolve(updateResponse);
                } else {
                    QuerypayLoad['clinicId'] = userData.id;
                    let InsertResponse = await DbOperations.saveData(settingSchema,QuerypayLoad);
                    return resolve(InsertResponse);
                }
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async getNotifications(userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                
                await commonFunctions.checkUserInformation(userData);
                const {start,end} = await commonFunctions.getUTCStartEndOfTheDay(); 
                let queryPayload = {
                    clinicId :  mongoose.Types.ObjectId(userData.id),
                    locationId :  mongoose.Types.ObjectId(userData.locationId),
                    $or:[{inQueue:true},{isCheckIn:true}, {isCheckOut:true}],
                    visitDate:{ $gte: new Date(start), $lte: new Date(end)},
                    is_delete: { $ne: true },
                    }
                const todayPatient = await DbOperations.findAll(ClinicPatient,queryPayload, {patientId:1}, {lean: true})
                let patientIds = [];
                for(let i=0; i<todayPatient.length;i++) {
                    patientIds.push(todayPatient[i].patientId);
                }
                let aggregate = [
                    {"$match":{type:1, isReadByAdmin:false, clinicId: mongoose.Types.ObjectId(userData.id),locationId :  mongoose.Types.ObjectId(userData.locationId), patientId: {$in:patientIds}}},
                    {"$lookup":{
                            "from":"users",
                            "localField":"clinicId",
                            "foreignField":"_id",
                            "as":"clinicData"
                        }},
                    {"$lookup":{
                            "from":"users",
                            "localField":"patientId",
                            "foreignField":"_id",
                            "as":"patientData"
                        }},
                    {"$unwind":{"path":"$clinicData"}},
                    {"$unwind":{"path":"$patientData"}},
                    {"$project":{
                        "_id":1,
                        "content":1,
                        "createdAt":1,
                        "clinicId": {
                            "_id": "$clinicData._id",
                            "fullNumber": "$clinicData.fullNumber",
                            "email": "$clinicData.email",
                            "userType": "$clinicData.userType"
                        },
                        "patientId": {
                            "_id": "$patientData._id",
                            "fullNumber": "$patientData.fullNumber",
                            "userType": "$patientData.userType",
                            "email": "$patientData.email",
                            "first_name": "$patientData.first_name",
                            "last_name": "$patientData.last_name"
                        },
                    }
                    },
                    {"$group":{
                        "_id":{ "patientId":"$patientId"},
                        "count":{"$sum":1},
                        "content":{"$push":"$content"},
                        "patientId":{"$first": "$patientId"},
                        "clinicId":{"$first": "$clinicId"}
                    }},
                    {"$project":{
                            "_id":0,
                            "count":"$count",
                            "content":"$content",
                            "patientId":"$patientId",
                            "clinicId":"$clinicId"
                        }}
                ]
                const getMessages = await DbOperations.aggregateData(Message,aggregate);
                return resolve(getMessages);
            } catch (err) {
                return reject(err);
            } 
        });
    }
    static async markMessageRead(payloadData,userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                if(!payloadData.patientId) {
                    throw {status:400, message:'Missing Required Parameter: patientId'}
                }
                const queryPayload = {patientId: payloadData.patientId, clinicId:userData.id, locationId:userData.locationId};
                const updatePayload = {isReadByAdmin:true};
                const response = await DbOperations.updateMany(Message,queryPayload,updatePayload,{new: true});                
                io.sockets.to(`room_${userData.id}`).emit('mark-unread', {clientId: userData.id,patientId:payloadData.patientId, locationId:userData.locationId});
                return resolve(response);
            } catch (err) {
                return reject(err);
            }
        });
    }
    static async updatePatientInfo(body, userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                if(!body.patientId) {
                    throw {status:400, message:'Missing Required Parameter: patientId'}
                }
                if(!body.first_name) {
                    throw ({status:400, message:'Missing parameter: first_name.'}) 
                }
                if(!body.last_name) {
                    throw ({status:400, message:'Missing parameter: last_name'}) 
                }
                if(!body.fullNumber) {
                    throw ({status:400, message:'Missing parameter: fullNumber'}) 
                }
                const payload = {
                    first_name: body.first_name,
                    last_name: body.last_name,
                    fullNumber: body.fullNumber
                }
                const {start,end} = await commonFunctions.getUTCStartEndOfTheDay(); 

                const [updateResponse, clinicFormId, response] = await Promise.all([
                    DbOperations.findAndUpdate(User,{_id: body.patientId},payload, {new: true}),                
                    commonFunctions.fetchJotformId(userData.locationId),
                    DbOperations.findOne(ClinicPatient,{is_delete: { $ne: true }, patientId: body.patientId, clinicId: userData.id, locationId:userData.locationId, visitDate:{ $gte: new Date(start), $lte: new Date(end)}}, {}, {lean: true})
                ])
                const submissionID = (response.submissionID) ? response.submissionID : null;
                if(!submissionID) {
                    return resolve(updateResponse);
                }
                // update jotform here ....
                await jotNameUpdate(payload, clinicFormId, submissionID)
                return resolve(updateResponse);
            } catch (err) {
                return reject(err);
            }
        });
    }
    static async markAllMessageRead(payloadData,userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                const queryPayload = {clinicId:userData.id, locationId:userData.locationId};
                const updatePayload = {isReadByAdmin:true};
                const response = await DbOperations.updateMany(Message,queryPayload,updatePayload,{new: true});                
                io.sockets.to(`room_${userData.id}`).emit('mark-all-Unread', {clientId: userData.id, locationId:userData.locationId});
                return resolve(response);
            } catch (err) {
                return reject(err);
            }
        });
    }
    static async patientRegister(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData) {
                    throw new Error("Missing Require Parameter's.")
                } 
                if(!payloadData.locationId) {
                    throw new Error('Missing Require Parameter:locationId')
                } 
                if(!payloadData.patientId) {
                    throw new Error('Missing Require Parameter:patientId')
                } 
                if(!payloadData.firstName) {
                    throw new Error('Missing Require Parameter:firstName.')
                } 
                if(!payloadData.lastName) {
                    throw new Error('Missing Require Parameter:lastName.')
                }
                if(!payloadData.email) {
                    throw new Error('Missing Require Parameter:email.')
                } 
                if(!payloadData.isTextNotification) {
                    throw new Error('Missing Require Parameter:isTextNotification')
                }
                if(payloadData.phoneNumber !== payloadData.reEnterPhone) {
                    throw new Error('phoneNumber are not same.Please check and try again.')
                }
                if(!payloadData.dob) {
                    throw new Error('Missing Require Parameter:dob')
                }
                if(!payloadData.gender) {
                    throw new Error('Missing Require Parameter:gender')
                }
                if(!payloadData.visitReason) {
                    throw new Error('Missing Require Parameter:visitReason')
                }
                if(!payloadData.visitType) {
                    throw new Error('Missing Require Parameter:visitType')
                }
                if(!payloadData.coronavirusContact) {
                    throw new Error('Missing Require Parameter:coronavirusContact')
                }
                if(!payloadData.hasPatient) {
                    throw new Error('Missing Require Parameter:hasPatient')
                }
                                
                const userPayload = {
                    first_name: payloadData.firstName,
                    last_name: payloadData.lastName,
                    email: payloadData.email,
                    gender: payloadData.gender,
                    dob: new Date(payloadData.dob),
                    isTextNotification: payloadData.isTextNotification,
                    hasPatient:payloadData.hasPatient
                }
                const {start,end} = await commonFunctions.getUTCStartEndOfTheDay(); 
                const clinicLocationData = await DbOperations.findOne(locationSchema,{_id:payloadData.locationId}, {twilioNumber:1, clinicId:1}, {lean: true});
                if(!clinicLocationData || !clinicLocationData.twilioNumber) {
                    throw new Error('This clinic location has not any messages number.Contact to Admin.')
                }   
                const clinicQuery = {
                    locationId:payloadData.locationId,
                    clinicId:clinicLocationData.clinicId,
                    patientId:payloadData.patientId,
                    visitDate: { $gte: new Date(start), $lte: new Date(end) },
                    is_delete: { $ne: true },
                    inQueue:true 
                }
                const [existClinicPatient, updatedUser, clinicSetting] = await Promise.all([
                    DbOperations.findOne(ClinicPatient,clinicQuery, {}, {lean: true}),
                    DbOperations.findAndUpdate(User, {_id:payloadData.patientId},userPayload),
                    DbOperations.findOne(settingSchema,{clinicId:clinicLocationData.clinicId}, {businessInformation:1}, {} )
                ])
                
                let clinicFormId = await commonFunctions.fetchJotformId(clinicLocationData._id) ; // '212500804377046';
                const clinicPayload = {
                   ...clinicQuery,
                   visitReason: payloadData.visitReason,
                   visitType: payloadData.visitType,
                   coronavirusContact: payloadData.coronavirusContact,
                   parkingSpot: (payloadData.parkingSpot) ? payloadData.parkingSpot : '',
                }
                delete clinicPayload.inQueue;
                delete clinicPayload.visitDate;
                let submissionId = (existClinicPatient && existClinicPatient.submissionID) ? existClinicPatient.submissionID : null;
                let phoneNumber = (updatedUser && updatedUser.fullNumber)? updatedUser.fullNumber : '';
                if(submissionId) {
                    await jotFormSubmit(payloadData, clinicFormId,phoneNumber, submissionId);
                } else {
                    submissionId = await jotFormSubmit(payloadData,clinicFormId,phoneNumber);
                    clinicPayload['submissionID'] = submissionId;
                }
    
                const responseJotFormUrl = `${process.env.HIPPA_JOT_URL}/edit/${submissionId}` ;
                if(!existClinicPatient) {
                    clinicPayload['visitDate'] = new Date();
                    clinicPayload['inQueueAt'] = new Date();
                    clinicPayload['inQueue'] = true;                    
                    await DbOperations.saveData(ClinicPatient,clinicPayload);
                    io.sockets.to(`room_${clinicLocationData.clinicId}`).emit('new-patient', {clientId:clinicLocationData.clinicId, locationId: clinicLocationData._id});
                } else {
                    await DbOperations.findAndUpdate(ClinicPatient,{_id:existClinicPatient._id},clinicPayload);
                    io.sockets.to(`room_${clinicLocationData.clinicId}`).emit('new-patient', {clientId:clinicLocationData.clinicId, locationId: clinicLocationData._id});
                }
                return resolve({url:responseJotFormUrl});
            } catch (error) {
                if (error.name === 'MongoError' && error.code === 11000) {
                    return reject((new Error('email must be unique. THis email already exist into our system.')));
                  } else {
                    return reject(error);
                  }
            }
        })
        
    }
    static async visitorList(payloadData,userData) {
        return new Promise(async (resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                const visitDate1 = new Date().toUTCString().substring(0, 16)
                let {start,end} = await commonFunctions.getformatedStartEndDay(visitDate1); 
                let visitDate ={ $gte: new Date(start), $lte: new Date(end)};
                
                if(payloadData.visitDate) {
                    const visitDate2 = new Date(payloadData.visitDate).toUTCString().substring(0, 16)
                    let {start,end} = await commonFunctions.getformatedStartEndDay(visitDate2); 
                    visitDate ={ $gte: new Date(start), $lte: new Date(end)} ;
                } 
                const settings = await DbOperations.findOne(
                    settingSchema,
                    { clinicId: userData.id },
                    { clientIncomplete: 1 },
                    {}
                  );
                let queryPayload = {
                    clinicId :  mongoose.Types.ObjectId(userData.id),
                    locationId: mongoose.Types.ObjectId(userData.locationId),
                    is_delete: { $ne: true },
                    visitDate:visitDate                    
                }
                if(!settings.clientIncomplete) {
                    queryPayload['submissionID'] = { $ne: null }
                }
                if(payloadData.filterStatus) {
                  //'Waiting':1,'check-In/out:2,'Served':3,'Blocked:4,'Delay'5
                  const filterStatus  = parseInt(payloadData.filterStatus) ;
                  switch(filterStatus) {
                    case 1:
                        queryPayload['inQueue'] = true  ;
                        queryPayload['isCheckIn'] = false ;
                        queryPayload['isCheckOut'] = false ;
                        break;
                    case 2:
                        queryPayload['inQueue'] = false  ;
                        queryPayload['isCheckIn'] = true ;
                        queryPayload['isCheckOut'] = false ;
                        break;
                    case 3:
                        queryPayload['inQueue'] = false  ;
                        queryPayload['isCheckIn'] = false ;
                        queryPayload['isCheckOut'] = true ;
                        break;
                    case 4:
                        queryPayload['is_block'] = true;
                        break;
                    case 5:
                        queryPayload['is_delay'] = true;
                        break;
                    default:
                        break;
                  }   
                }
                let aggregate=[
                    {"$match":queryPayload},
                    {"$lookup":{
                            "from":"users",
                            "localField":"clinicId",
                            "foreignField":"_id",
                            "as":"clinicData"
                        }},
                    {"$lookup":{
                            "from":"users",
                            "localField":"patientId",
                            "foreignField":"_id",
                            "as":"patientData"
                        }},
                    {"$unwind":{"path":"$clinicData"}},
                    {"$unwind":{"path":"$patientData"}}
                ]
                if(payloadData.searchBy) {
                    aggregate.push({"$match":{
                        "$or":[
                            {"patientData.first_name":new RegExp(payloadData.searchBy, 'i')},
                            {"patientData.last_name":new RegExp(payloadData.searchBy, 'i')}                  
                        ]
                        }
                    });
                }
                aggregate.push(
                    {"$project":{
                        "_id":1,
                        "inQueue":1,
                        "isCancel":1,
                        "isCheckIn":1,
                        "isCheckOut":1,
                        "is_block":1,
                        "is_delay":1,
                        "inQueueAt":1,
                        "checkIn":1,
                        "checkOut":1,
                        "noShow":1,
                        "clinicId": {
                            "_id": "$clinicData._id",
                            "fullNumber": "$clinicData.fullNumber",
                            "email": "$clinicData.email",
                            "userType": "$clinicData.userType"
                        },
                        "patientId": {
                            "_id": "$patientData._id",
                            "fullNumber": "$patientData.fullNumber",
                            "userType": "$patientData.userType",
                            "email": "$patientData.email",
                            "first_name": "$patientData.first_name",
                            "last_name": "$patientData.last_name",
                            "visitNotes":"$patientData.visitNotes",
                            "dob":"$patientData.dob",
                            "status":"$patientData.status"
                        },
                        "visitDate": 1,
                        "createdAt": 1,
                        "updatedAt": 1,
                        "parkingSpot": 1,
                        "notifyTime":1,
                        "isNotify":1,
                        "notifyAt":1,
                        "visitReason":1,
                        "visitType":1,
                        "coronavirusContact":1,
                        "submissionID":1
                    }
                    }
                );
                const patientList=await DbOperations.aggregateData(ClinicPatient,aggregate);
                for (const p of patientList) {
                    p['isExisting'] = (await DbOperations.count(ClinicPatient, {patientId: p.patientId._id})) > 1;
                }
                return resolve(patientList);
            } catch (err) {
                return reject(err);
            }
        });
    }
    static async visitorReviews(payloadData,userData) {
        return new Promise(async (resolve,reject)=> {
            try {
                let {start,end} = await commonFunctions.getUTCStartEndOfTheDay(); 
                let visitDate ={ $gte: new Date(start), $lte: new Date(end)};
                
                if(payloadData.visitDate) {
                    let {start,end} = await commonFunctions.getformatedStartEndDay(payloadData.visitDate); 
                    visitDate ={ $gte: new Date(start), $lte: new Date(end)} ;
                } 
                console.log("visitDate", visitDate);
                const queryPayload = {
                    locationId: mongoose.Types.ObjectId(userData.locationId),
                    createdAt:visitDate                    
                }
                let aggregate=[
                    {"$match":queryPayload},
                    {"$lookup":{
                            "from":"locations",
                            "localField":"locationId",
                            "foreignField":"_id",
                            "as":"locationData"
                        }},
                    {"$lookup":{
                            "from":"users",
                            "localField":"patientId",
                            "foreignField":"_id",
                            "as":"patientData"
                        }},
                    {"$unwind":{"path":"$locationData"}},
                    {"$unwind":{"path":"$patientData"}}
                ]
                if(payloadData.searchBy) {
                    aggregate.push({"$match":{
                        "$or":[
                            {"patientData.first_name":new RegExp(payloadData.searchBy, 'i')},
                            {"patientData.last_name":new RegExp(payloadData.searchBy, 'i')}                  
                        ]
                        }
                    });
                }
                aggregate.push(
                    {"$project":{
                        "_id":1,
                        "locationId": {
                            "_id": "$locationData._id",
                            "name": "$locationData.name",
                            "twilioNumber": "$locationData.twilioNumber",
                            "clinicId": "$locationData.clinicId"
                        },
                        "patientId": {
                            "_id": "$patientData._id",
                            "fullNumber": "$patientData.fullNumber",
                            "userType": "$patientData.userType",
                            "email": "$patientData.email",
                            "first_name": "$patientData.first_name",
                            "last_name": "$patientData.last_name",
                            "visitNotes":"$patientData.visitNotes",
                            "dob":"$patientData.dob",
                            "status":"$patientData.status"
                        },
                        "createdAt": 1,
                        "updatedAt": 1,
                        "point":1,
                        "comment":1
                    }
                    }
                );
                const reviewList=await DbOperations.aggregateData(reviewSchema,aggregate);
                console.log('\n reviewList:', reviewList)
                return resolve(reviewList);
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async updateSignageInformation(payloadData ,userData, fileData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                if(!payloadData.companyName) {
                    throw {status:400, message:'Missing Required Parameter: companyName'}
                }
                if(!payloadData.companyAddress) {
                    throw {status:400, message:'Missing Required Parameter: companyAddress'}
                }
                if(!payloadData.generatedPhoneNumber) {
                    throw {status:400, message:'Missing Required Parameter: generatedPhoneNumber'}
                }
                if(!payloadData.signNumber) {
                    throw {status:400, message:'Missing Required Parameter: signNumber'}
                }
                const criteria = {clinicId:userData.id};
                const QuerypayLoad ={
                    signageInformation : {
                        companyName:payloadData.companyName,
                        companyAddress:payloadData.companyAddress,
                        generatedPhoneNumber: payloadData.generatedPhoneNumber,
                        signNumber:payloadData.signNumber
                    }
                };
                if(fileData && fileData.hasOwnProperty('filename')) {
                    QuerypayLoad.signageInformation['logo'] = fileData.filename;
                }
                const response = await DbOperations.findOne(settingSchema,criteria, {}, {} );
                if(response) {
                    const updateResponse = await DbOperations.findAndUpdate(settingSchema,criteria,QuerypayLoad, {new: true});                
                    return resolve(updateResponse);
                } else {
                    QuerypayLoad['clinicId'] = userData.id;
                    let InsertResponse = await DbOperations.saveData(settingSchema,QuerypayLoad);
                    return resolve(InsertResponse);
                }
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async updateIsOpenSetting(payloadData ,userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                const criteria = {_id:userData.locationId};
                const QuerypayLoad ={ isOpen: payloadData.isOpen}
                const response = await DbOperations.findOne(locationSchema,criteria, {}, {} );
                if(!response) {
                    throw({status:400, message:'No location found.'})
                }
                io.sockets
                    .to(`room_${userData.id}`)
                    .emit("location-open", {
                        clientId: userData.id,
                        locationId: userData.locationId,
                        isOpen: payloadData.isOpen
                    });
                const updateResponse = await DbOperations.findAndUpdate(locationSchema,criteria,QuerypayLoad, {new: true});                
                return resolve(updateResponse);
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async scheduleInformation(payloadData ,userData) {
        return new Promise(async(resolve,reject)=> {
            try {
                await commonFunctions.checkUserInformation(userData);
                const criteria = {_id: mongoose.Types.ObjectId(userData.locationId)};
                const QuerypayLoad ={ 
                    isScheduleOpen: payloadData.isScheduleOpen,
                    isScheduleClose: payloadData.isScheduleClose,
                    selectedTimeZone: payloadData.selectedTimeZone,
                    openingTime: payloadData.openingTime,
                    closingTime: payloadData.closingTime,
                    // twilioNumber: payloadData.twilioNumber,
                }
                const response = await DbOperations.findOne(locationSchema,criteria, {}, {} );
                if(!response) {
                    throw({status:400, message:'No location found.'})
                }
                const updateResponse = await DbOperations.findAndUpdate(locationSchema,criteria,QuerypayLoad, {new: true});                
                return resolve(updateResponse);
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async getBusinessDetail(payload) {
        return new Promise(async (resolve,reject) => {
            try {
                if(!payload || !payload.locationId) {
                    throw({status:400, message:'Missing query parameter:locationId.'})
                }
                const response = await DbOperations.findOne(locationSchema,{_id:mongoose.Types.ObjectId(payload.locationId)}, {clinicId:1}, {} );
                if(!response) {
                    throw({status:400, message:'No location found.'})
                }
                if(!response.clinicId) {
                    throw({status:400, message:'No clinicId found for location.'})
                }
                const clinicData = await DbOperations.findOne(settingSchema,{clinicId:mongoose.Types.ObjectId(response.clinicId)}, {businessInformation:1}, {} );
                return resolve(clinicData);
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async addReview(payload) {
        return new Promise(async(resolve,reject)=> {
            try {
                if(!payload) {
                    throw({status:400, message:'Missing required parameters.'})
                }
                if(!payload.locationId) {
                 throw({status:400, message:'Missing required parameter:locationId.'})
                }
                if(!payload.patientId) {
                    throw({status:400, message:'Missing required parameter:patientId.'})
                }
                if(!payload.hasOwnProperty('comment')) {
                    throw({status:400, message:'Missing required parameter:comment.'})
                }
                const {start,end} = await commonFunctions.getUTCStartEndOfTheDay();
                const queryPayload = {
                    patientId: payload.patientId, 
                    locationId:payload.locationId, 
                    createdAt:{ $gte: new Date(start), $lte: new Date(end)}};
                const checkReviewExist = await DbOperations.findOne(reviewSchema,queryPayload, {_id:1}, {lean: true});
                if(checkReviewExist) {
                    let response = DbOperations.findAndUpdate(reviewSchema,{_id: checkReviewExist._id},{comment:payload.comment}, {new: true})
                    return resolve(response); 
                } else {
                    let response = await DbOperations.saveData(reviewSchema,payload);
                    return resolve(response);  
                }
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async anotherPatientRegister(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData) {
                    throw new Error("Missing Require Parameter's.")
                } 
                if(!payloadData.locationId) {
                    throw new Error('Missing Require Parameter:locationId')
                } 
                 
                if(!payloadData.firstName) {
                    throw new Error('Missing Require Parameter:firstName.')
                } 
                if(!payloadData.lastName) {
                    throw new Error('Missing Require Parameter:lastName.')
                }
                if(!payloadData.email) {
                    throw new Error('Missing Require Parameter:email.')
                } 
                if(!payloadData.isTextNotification) {
                    throw new Error('Missing Require Parameter:isTextNotification')
                }
                if(!payloadData.fullNumber) {
                    throw new Error('Missing Require Parameter:fullNumber.')
                }
                if(!payloadData.dob) {
                    throw new Error('Missing Require Parameter:dob')
                }
                if(!payloadData.gender) {
                    throw new Error('Missing Require Parameter:gender')
                }
                if(!payloadData.visitReason) {
                    throw new Error('Missing Require Parameter:visitReason')
                }
                if(!payloadData.visitType) {
                    throw new Error('Missing Require Parameter:visitType')
                }
                if(!payloadData.coronavirusContact) {
                    throw new Error('Missing Require Parameter:coronavirusContact')
                }
                if(!payloadData.hasPatient) {
                    throw new Error('Missing Require Parameter:hasPatient')
                }
                                
                const userPayload = {
                    first_name: payloadData.firstName,
                    last_name: payloadData.lastName,
                    email: payloadData.email,
                    gender: payloadData.gender,
                    dob: new Date(payloadData.dob),
                    isTextNotification: payloadData.isTextNotification,
                    hasPatient:payloadData.hasPatient
                }
    
                const {start,end} = await commonFunctions.getUTCStartEndOfTheDay(); 
                const [clinicLocationData, checkPhoneExist] = await Promise.all([
                    DbOperations.findOne(locationSchema,{_id:payloadData.locationId}, {twilioNumber:1, clinicId:1}, {lean: true}),
                    DbOperations.findOne(User,{userType:2, fullNumber: payloadData.fullNumber}, {}, {lean: true} )
                ]) 
                if(checkPhoneExist) {
                    throw new Error('Patient with Provided Phone Number is already exist. Please contact to site Admin.')
                }
                if(!clinicLocationData || !clinicLocationData.twilioNumber) {
                    throw new Error('This clinic location has not any messages number.Contact to Admin.')
                }
                const insertPayload = {
                    userType:2,
                    fullNumber: payloadData.fullNumber,
                    locationId: clinicLocationData._id,
                    clinicId: clinicLocationData.clinicId,
                }
                let insertedPatient = await DbOperations.saveData(User,insertPayload);
                console.log('\n insertedPatient:', insertedPatient) ;
                payloadData.patientId = insertedPatient._id ;
                if(!payloadData.patientId) {
                    throw new Error('Missing Require Parameter:patientId')
                }   
                const clinicQuery = {
                    locationId:payloadData.locationId,
                    clinicId:clinicLocationData.clinicId,
                    patientId:payloadData.patientId,
                    visitDate: { $gte: new Date(start), $lte: new Date(end) },
                    is_delete: { $ne: true },
                    inQueue:true 
                }
                const [existClinicPatient, updatedUser, clinicSetting] = await Promise.all([
                    DbOperations.findOne(ClinicPatient,clinicQuery, {}, {lean: true}),
                    DbOperations.findAndUpdate(User, {_id:payloadData.patientId},userPayload),
                    DbOperations.findOne(settingSchema,{clinicId:clinicLocationData.clinicId}, {businessInformation:1}, {} )
                ])
                
                let clinicFormId = await commonFunctions.fetchJotformId(clinicLocationData._id) ; // '212500804377046';
                const clinicPayload = {
                   ...clinicQuery,
                   visitReason: payloadData.visitReason,
                   visitType: payloadData.visitType,
                   coronavirusContact: payloadData.coronavirusContact,
                   parkingSpot: (payloadData.parkingSpot) ? payloadData.parkingSpot : '',
                }
                delete clinicPayload.inQueue;
                delete clinicPayload.visitDate;
                let submissionId = (existClinicPatient && existClinicPatient.submissionID) ? existClinicPatient.submissionID : null;
                let phoneNumber = (updatedUser && updatedUser.fullNumber)? updatedUser.fullNumber : '';
                if(submissionId) {
                    console.log('\n when submissition id')
                    await jotFormSubmit(payloadData, clinicFormId,phoneNumber, submissionId);
                } else {
                    console.log('\n when no submissition id')
                    submissionId = await jotFormSubmit(payloadData,clinicFormId,phoneNumber);
                    console.log('\n submissionId:', submissionId);
                    clinicPayload['submissionID'] = submissionId;
                }
    
                const responseJotFormUrl = `${process.env.HIPPA_JOT_URL}/edit/${submissionId}` ;
                if(!existClinicPatient) {
                    clinicPayload['visitDate'] = new Date();
                    clinicPayload['inQueueAt'] = new Date();
                    clinicPayload['inQueue'] = true;
                    await DbOperations.saveData(ClinicPatient,clinicPayload);
                    io.sockets.to(`room_${clinicLocationData.clinicId}`).emit('new-patient', {clientId:clinicLocationData.clinicId, locationId: clinicLocationData._id});
                } else {
                    await DbOperations.findAndUpdate(ClinicPatient,{_id:existClinicPatient._id},clinicPayload);
                    io.sockets.to(`room_${clinicLocationData.clinicId}`).emit('new-patient', {clientId:clinicLocationData.clinicId, locationId: clinicLocationData._id});
                }
                return resolve({url:responseJotFormUrl});
            } catch (error) {
                if (error.name === 'MongoError' && error.code === 11000) {
                    return reject((new Error('email must be unique. THis email already exist into our system.')));
                  } else {
                    return reject(error);
                  }
            }
        })
        
    }
    static async saveNumber(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData) {
                    throw new Error("Missing Require Parameter's.")
                } 
                if(!payloadData.locationId) {
                    throw new Error('Missing Require Parameter:locationId')
                } 
                 
                if(!payloadData.fullNumber) {
                    throw new Error('Missing Require Parameter:fullNumber.')
                }
                const {start,end} = await commonFunctions.getUTCStartEndOfTheDay(); 
                const [clinicLocationData, checkPhoneExist] = await Promise.all([
                    DbOperations.findOne(locationSchema,{_id:payloadData.locationId}, {}, {lean: true}),
                    DbOperations.findOne(User,{userType:2, fullNumber: payloadData.fullNumber}, {}, {lean: true} )
                ]) 
                if (!clinicLocationData) {
                    throw { status: 400, message: 'No location found for this locationId.' };
                }
                if(!clinicLocationData.twilioNumber) {
                    throw new Error('This clinic location has not any twilio number.Contact to Admin.')
                }
                if(!checkPhoneExist) {
                    const insertPayload = {
                        userType:2,
                        fullNumber: payloadData.fullNumber,
                        locationId: clinicLocationData._id,
                        clinicId: clinicLocationData.clinicId,
                    }
                    let insertedPatient = await DbOperations.saveData(User,insertPayload);
                    console.log('\n insertedPatient:', insertedPatient) ;
                    payloadData.patientId = insertedPatient._id ;
                } else {
                    payloadData.patientId = checkPhoneExist._id ;
                }
    
                if(!payloadData.patientId) {
                    throw new Error('Missing Require Parameter:patientId')
                }  
                const messageQuery = {
                    type:2,
                    initial_message:true,
                    patientId:payloadData.patientId,
                    clinicId:clinicLocationData.clinicId,
                    locationId:clinicLocationData._id,
                    createdAt:{ $gte: new Date(start), $lte: new Date(end) }
                }
                
                const clinicQuery = {
                    locationId:clinicLocationData._id,
                    clinicId:clinicLocationData.clinicId,
                    patientId:payloadData.patientId,
                    visitDate: { $gte: new Date(start), $lte: new Date(end) },
                    is_delete: { $ne: true },
                    inQueue: true
                }
                const [existClinicPatient, updatedUser, clinicFormId, alreadyMessageSend] = await Promise.all([
                    DbOperations.findOne(ClinicPatient,clinicQuery, {}, {lean: true}),
                    DbOperations.findOne(User, {_id:payloadData.patientId},{}, {lean: true}),
                    commonFunctions.fetchJotformId(clinicLocationData._id),
                    DbOperations.findOne(Message,messageQuery)
                ])
    
                if(alreadyMessageSend) {
                    console.log('\n alreadyMessageSend:', alreadyMessageSend)
                    return resolve({url:alreadyMessageSend.content || ''})
                }
                
                if (existClinicPatient) {
                    throw new Error('Patient already register for the day with provided number.')
                } 
                const submissionId = await jotFormSubmit(clinicLocationData._id, clinicFormId, updatedUser.fullNumber);
                const clinicPayload = {
                    ...clinicQuery,
                    inQueue: false,
                    submissionID: submissionId
                }
                delete clinicPayload.visitDate;
                clinicPayload['visitDate'] = new Date();
                await DbOperations.saveData(ClinicPatient, clinicPayload);
    
                const responseJotFormUrl = `${process.env.HIPPA_JOT_URL}/edit/${submissionId}`;
                await commonFunctions.initialUpdateMessage(clinicLocationData._id, clinicLocationData.clinicId, updatedUser._id, responseJotFormUrl, 2);
                //#here find jotform for clinic and send into response.
                console.log('\n responseJotFormUrl:', responseJotFormUrl);
                return resolve({url:responseJotFormUrl})
            } catch (error) {
                console.log("\n==\n error error:", error);
                if (error.name === 'MongoError' && error.code === 11000) {
                    return reject((new Error('email must be unique. THis email already exist into our system.')));
                  } else {
                    return reject(error);
                  }
            }
        })
    }
}

module.exports = UserController;

//================Helper=======================//
async function jotFormSubmit(payloadData, FormId, fullNumber, submissionId=null) {
    return new Promise(async(resolve,reject)=> {
        try {
            console.log('\n submissionId:', submissionId)
            const [questions, year,month, day] = await Promise.all([
                commonFunctions.getFormQuestions(FormId),
                commonFunctions.formatDate(payloadData.dob, 'YYYY'),
                commonFunctions.formatDate(payloadData.dob, 'MM'),
                commonFunctions.formatDate(payloadData.dob, 'DD')
            ]);
            if(questions) {
                const fieldData = {};
                for (let [key, value] of Object.entries(questions)) {
                    if(value && value.hasOwnProperty('name')) {
                        let fieldName = value.name;
                        let qid = ( value.hasOwnProperty('qid')) ? value.qid : 0;
                        switch (fieldName) {
                            case 'whatParking':
                                fieldData[`submission[${qid}]`] = (payloadData.parkingSpot) ? payloadData.parkingSpot : '';
                                break;
                            case 'hasPatient':
                                fieldData[`submission[${qid}]`] = (payloadData.hasPatient && (payloadData.hasPatient === 1)) ? 'YES' : 'NO';
                                break;
                            case 'patientName':
                                fieldData[`submission[${qid}_first]`] = payloadData.firstName;
                                fieldData[`submission[${qid}_last]`] = payloadData.lastName;
                                break;
                            case 'dateOfBirth':
                                fieldData[`submission[${qid}_year]`] =year;
                                fieldData[`submission[${qid}_month]`] = month;
                                fieldData[`submission[${qid}_day]`] = day;
                                break;
                            case 'reasonFor':
                                fieldData[`submission[${qid}]`] = payloadData.visitReason;
                                break;
                            case 'email':
                                fieldData[`submission[${qid}]`] = (payloadData.email) ? payloadData.email:'';
                                break;
                            case 'phoneNumber':
                                fieldData[`submission[${qid}]`] = fullNumber;
                                break;
                            case 'location_id':
                                fieldData[`submission[${qid}]`] = payloadData.locationId;
                            default:
                                break;
                        }
                    }
                }
                const isFieldDataEmpty = await commonFunctions.IsEmpty(fieldData);
                if(!isFieldDataEmpty) {
                    if(!submissionId) {
                        const submissionResponse =  await commonFunctions.createFormSubmission(FormId, fieldData) ;
                        if(submissionResponse && submissionResponse.hasOwnProperty('submissionID')) {
                            return resolve(submissionResponse.submissionID)
                        } else {
                            return resolve('');
                        }
                    } else {
                        const submissionUpdateResponse =  await commonFunctions.editFormSubmission(submissionId, fieldData) ;
                        return resolve(submissionUpdateResponse)
                    }
                } else {
                    return reject({message:'contact to Admin jot form is empty without required field'});
                }
            }
            return reject({message:'contact to Admin, No question found for clinic jot form.'});
        } catch (err) {
            return reject(err);
        }
    })
}
async function jotNameUpdate(payloadData, FormId, submissionId=null) {
    return new Promise(async(resolve,reject)=> {
        try {
            const [questions] = await Promise.all([
                commonFunctions.getFormQuestions(FormId)
            ]);
            if(questions) {
                const fieldData = {};
                for (let [key, value] of Object.entries(questions)) {
                    if(value && value.hasOwnProperty('name')) {
                        let fieldName = value.name;
                        let qid = ( value.hasOwnProperty('qid')) ? value.qid : 0;
                        switch (fieldName) {
                            case 'patientName':
                                fieldData[`submission[${qid}_first]`] = payloadData.first_name;
                                fieldData[`submission[${qid}_last]`] = payloadData.last_name;
                                break;
                            default:
                                break;
                        }
                    }
                }
                console.log('\n update fieldData:', fieldData) ;
                const isFieldDataEmpty = await commonFunctions.IsEmpty(fieldData);
                if(!isFieldDataEmpty) {
                    const submissionUpdateResponse =  await commonFunctions.editFormSubmission(submissionId, fieldData) ;
                    return resolve(submissionUpdateResponse)
                } else {
                    return reject({message:'contact to Admin jot form is empty without required field'});
                }
            }
            return reject({message:'contact to Admin, No question found for clinic jot form.'});
        } catch (err) {
            return reject(err);
        }
    })
}
/* async function prepairJotForm(payloadData, locationData, submissionId, patientNumber) {
    return new Promise(async(resolve,reject) => {
        try {
            const [formId, year,month, day] = await Promise.all([
                commonFunctions.fetchJotformId(locationData, 2), // '212500804377046';
                commonFunctions.formatDate(payloadData.dob, 'YYYY'),
                commonFunctions.formatDate(payloadData.dob, 'MM'),
                commonFunctions.formatDate(payloadData.dob, 'DD')
            ]);
        let genderType = 'Male';
        switch(payloadData.gender) {
            case 1:
                genderType = 'Male';
                break;
            case 2:
                genderType = 'Female';
                break;
            case 3:
                genderType = 'Other';
                break;
            default:
                break;

        }
        const encodedPatientNumber =  encodeURIComponent('phoneNumbers[1]'),
        encodedDobY =  encodeURIComponent('dateOfBirth[year]'),
	    encodedDobM = encodeURIComponent('dateOfBirth[month]'),
	    encodedDobD = encodeURIComponent('dateOfBirth[day]'),
	    encodeFirstName =  encodeURIComponent('patientName[first]'),
	    encodeLastName = encodeURIComponent('patientName[last]');     
            const jotFormUrl = `https://form.jotform.com/${formId}?${encodedPatientNumber}=${patientNumber}&${encodedDobY}=${year}&${encodedDobM}=${month}&${encodedDobD}=${day}&${encodeFirstName}=${payloadData.firstName}&${encodeLastName}=${payloadData.lastName}&form1_Submission=${submissionId}&gender=${genderType}&email=${payloadData.email}`;
            const {status,message, short_response} = await commonFunctions.shorterUrl(jotFormUrl);
            if (!status) {
                console.log("prepairJotForm bitly message:", message);
                return resolve(jotFormUrl);
            }
            console.log("\n\n response bitly:", short_response);
            const short_url = short_response && short_response.link ? short_response.link : jotFormUrl; 
            return resolve(encodeURI(short_url));
        } catch (err) {
            return reject(err);
        }
    })
} */