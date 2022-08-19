import {DbOperations, commonFunctions} from '../services';
import {User, locationSchema, jotformSchema, settingSchema, Message, ClinicPatient} from '../models';
var mongoose = require('mongoose');

class AdminController {
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
                var checkEmailExist = await DbOperations.findOne(User,{email: payloadData.email, userType:3}, {}, {lean: true} );
                if(!checkEmailExist) {
                    throw {status:404, message:'Incorrect Credentials.Please check and try later.'};
                }
                let checkPassword = await commonFunctions.compareHashPassword(payloadData.password, checkEmailExist.password)
                if(!checkPassword) {
                    throw {status:403, message:'incorrect password'};
                }

                let loginTime = (+new Date())
                let tz = Math.floor((Math.random() * 10000) + 10000);
                let tokenData = {
                    id: checkEmailExist._id,
                    loginTime: loginTime,
                    random: tz,
                    type: checkEmailExist.userType || 3
                };
                delete checkEmailExist.password;
                delete checkEmailExist.__v;
                let [token] = await Promise.all([
                    commonFunctions.setToken(tokenData),
                ])
                checkEmailExist.accessToken = token.accessToken;
                return resolve(checkEmailExist);
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async dashboard () {
        return new Promise(async(resolve,reject)=>{
            try {
                const [totalProvider,totalLocations,totalJotforms] = await Promise.all([
                    DbOperations.count(User, {userType:1,is_deleted:false}),
                    DbOperations.count(locationSchema, {isActive:true}),
                    DbOperations.count(jotformSchema, {isActive:true}),
                ])
                return resolve({totalProvider:totalProvider,totalLocations:totalLocations, totalJotforms});
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async clientList(payload) {
        return new Promise(async(resolve,reject)=>{
            try {
                const options = {
                    page: (payload.page && parseInt(payload.page) > 0) ? parseInt(payload.page) - 1 : 0,
                    limit: parseInt(payload.limit) || 10,
                };
                const selection = {
                    email:1,
                    createdAt:1,
                    updatedAt:1,
                    status:1,
                    allowLocationAdd:1
                }
                const optionsPayload = { skip: options.page * options.limit, limit: options.limit, lean:true };
                const queryPayload = {userType:1,is_deleted:false};
                
                const [totalProvider,providers] = await Promise.all([
                    DbOperations.count(User, queryPayload),
                    DbOperations.findAll(User, queryPayload,selection,optionsPayload)
                ]);
                return resolve({providers:providers,total_records:totalProvider});
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async jotformList(payload) {
        return new Promise(async(resolve,reject)=>{
            try {
                const options = {
                    page: (payload.page && parseInt(payload.page) > 0) ? parseInt(payload.page) - 1 : 0,
                    limit: parseInt(payload.limit) || 10,
                };
                const optionsPayload = { skip: options.page * options.limit, limit: options.limit, lean:true };
                const queryPayload = {isActive:true};
                
                const [totalProvider,providers] = await Promise.all([
                    DbOperations.count(jotformSchema, queryPayload),
                    DbOperations.findAll(jotformSchema, queryPayload,null,optionsPayload)
                ]);
                return resolve({providers:providers,total_records:totalProvider});
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async clientLocations(payload) {
        return new Promise(async(resolve,reject)=>{
            try {
                if(!payload || !payload.clientId) {
                   throw {status:400, message:"Missing Require Query Parameter: clientId"};
                } 
                const options = {
                    page: (payload.page && parseInt(payload.page) > 0) ? parseInt(payload.page) - 1 : 0,
                    limit: parseInt(payload.limit) || 10,
                };
                const selection = {}
                const optionsPayload = { skip: options.page * options.limit, limit: options.limit, lean:true };
                const queryPayload = {isActive:true, clinicId: mongoose.Types.ObjectId(payload.clientId)};
                const populateQuery = [{
                    path: 'clinicId',
                    select: {
                        _id:1,
                        first_name: 1,
                        last_name: 1,
                        email:1
                    }
                }, {
                    path: 'jotformId',
                    select: {
                        _id:1,
                        jotformId: 1,
                        name: 1,
                    }
                }];
                const [totalLocations,providers] = await Promise.all([
                    DbOperations.count(locationSchema,queryPayload),
                    DbOperations.getData(locationSchema, queryPayload ,selection,optionsPayload, populateQuery)
                ]);
                return resolve({providers:providers,total_records:totalLocations});
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async addTwilioNumber(payload) {
        return new Promise(async(resolve,reject) => {
            try {
                if(!payload) {
                    throw {status:400, message:"Missing Require Parameter's"};
                } 
                if(!payload.locationId) {
                    throw {status:400, message:"Missing Require Parameter: locationId"};
                } 
                if(!payload.twilio_number) {
                    throw {status:400, message:"Missing Require Parameter: twilio_number"};
                } 
                const queryPayload = {twilioNumber: payload.twilio_number, _id:{ $nin:[mongoose.Types.ObjectId(payload.locationId)]}} ;
                var checkNumber = await DbOperations.findOne(locationSchema,queryPayload, {}, {lean: true} );
                if(checkNumber) {
                    throw {status:409, message:"Same twilio number already assign to any location."}
                }
                const updatePayload = { twilioNumber : payload.twilio_number };
                const response = await DbOperations.findAndUpdate(locationSchema, {_id: mongoose.Types.ObjectId(payload.locationId)}, updatePayload, { new: true });
                return resolve(response);
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async addLocationJotform(payload) {
        return new Promise(async(resolve,reject) => {
            try {
                if(!payload) {
                    throw {status:400, message:"Missing Require Parameter's"};
                } 
                if(!payload.locationId) {
                    throw {status:400, message:"Missing Require Parameter: locationId"};
                } 
                if(!payload.jotformId) {
                    throw {status:400, message:"Missing Require Parameter: jotformId"};
                }
                const updatePayload = { jotformId : payload.jotformId };
                const response = await DbOperations.findAndUpdate(locationSchema, {_id: mongoose.Types.ObjectId(payload.locationId)}, updatePayload, { new: true });
                return resolve(response);
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
                        timeZone: payloadData.selectedTimeZone,
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
    static async addClientLocation(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData) {
                    throw new Error("Missing Require Parameter's.")
                } 
                if(!payloadData.name) {
                    throw new Error('Missing Require Parameter:name')
                }
                if(!payloadData.twilioNumber) {
                    throw new Error('Missing Require Parameter:twilioNumber')
                }
                if(!payloadData.clientId) {
                    throw new Error('Missing Require Parameter:clientId')
                }
                if(!payloadData.jotformId) {
                    throw new Error('Missing Require Parameter:jotformId')
                }
                const queryPayload = {twilioNumber: payloadData.twilioNumber} ;
                var checkNumber = await DbOperations.findOne(locationSchema,queryPayload, {}, {lean: true} );
                if(checkNumber) {
                    throw {status:409, message:"Same twilio number already assign to any location."}
                }
                
                const payload = {
                    name: payloadData.name,
                    twilioNumber: payloadData.twilioNumber,
                    clinicId: payloadData.clientId,
                    jotformId: payloadData.jotformId,
                    isOpen:true
                }
                let response = await DbOperations.saveData(locationSchema,payload);
                return resolve({location:response});
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async addJotform(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData) {
                    throw new Error("Missing Require Parameter's.")
                } 
                if(!payloadData.name) {
                    throw new Error('Missing Require Parameter:name')
                }
                
                const payload = {
                    name: payloadData.name,
                    jotformId: payloadData.jotformId,
                }
                let response = await DbOperations.saveData(jotformSchema,payload);
                return resolve({location:response});
            } catch (err) {
                return reject(err);
            }
        })
        
    }
    static async updateClientStatus(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData.clientId) {
                    throw new Error('Missing Require Parameter:clientId')
                }
                var checkExist = await DbOperations.findOne(User,{_id: payloadData.clientId, userType:1}, {}, {lean: true} );
                if(!checkExist) {
                    throw {status:404, message:'Record not exist into system. Please contact to Admin.'};
                }
                const response = await DbOperations.findAndUpdate(User,{_id: checkExist._id},{status: payloadData.status || !checkExist.status}, {new: true})
                return resolve({response});
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async allowLocationAdd(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData.clientId) {
                    throw new Error('Missing Require Parameter:clientId')
                }
                var checkExist = await DbOperations.findOne(User,{_id: payloadData.clientId, userType:1}, {}, {lean: true} );
                if(!checkExist) {
                    throw {status:404, message:'Record not exist into system. Please contact to Admin.'};
                }
                const response = await DbOperations.findAndUpdate(User,{_id: checkExist._id},{allowLocationAdd: payloadData.allowLocationAdd || !checkExist.allowLocationAdd}, {new: true})
                return resolve({response});
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async locationSmsFeature(payloadData) {
        return new Promise(async (resolve,reject)=> {
            try {
                if(!payloadData.clientId) {
                    throw new Error('Missing Require Parameter:clientId')
                }
                if(!payloadData.location) {
                    throw new Error('Missing Require Parameter:location')
                }
                
                var checkExist = await DbOperations.findOne(User,{_id: payloadData.clientId, userType:1}, {}, {lean: true} );
                if(!checkExist) {
                    throw {status:404, message:'Clinic not exist into system. Please contact to Admin.'};
                }

                var checkLocationExist = await DbOperations.findOne(locationSchema,{_id: payloadData.location}, {}, {lean: true} );
                if(!checkLocationExist) {
                    throw {status:404, message:'Location not exist into system. Please contact to Admin.'};
                }

                const response = await DbOperations.findAndUpdate(locationSchema,{_id: checkLocationExist._id},{allowSmsFeature: payloadData.allowSmsFeature || !checkLocationExist.allowSmsFeature}, {new: true})
                return resolve({response});
            } catch (err) {
                return reject(err);
            }
        })
    }
    static async clinicAnalyticsData(payload) {
        return new Promise(async(resolve,reject)=>{
            try {
                if(!payload || !payload.locationId) {
                   throw {status:400, message:"Missing Require Query Parameter: locationId"};
                } 
                const populateQuery = [{
                    path: 'clinicId',
                    select: {
                        _id:1,
                        first_name: 1,
                        last_name: 1,
                        email:1
                    }
                }];
                const data = await commonFunctions.getWeekMonthYearStartEnd()
                let aggregate = [
                    {"$match":{locationId: mongoose.Types.ObjectId(payload.locationId)}},
                    {
                      $sort: {
                        createdAt: 1
                      }
                    },
                    {
                      $group: {
                        _id: "$patientId",
                        createdAt: {
                          $last: "$createdAt"
                        },
                        count: { $sum: 1 }
                      }
                    },
                    {
                      $project: {
                        _id: 0,
                        patientId: "$_id",
                        lastCreatedAt: "$createdAt",
                        count:"$count"
                      }
                    }
                  ]
                  //DbOperations.getData(locationSchema, {_id:payload.locationId} ,{},{lean:true}, populateQuery),
                const [locationData,totalPatient,weeklySms, monthlySms, yearlySms] = await Promise.all([
                    DbOperations.findOne(locationSchema,{_id:payload.locationId}, {}, {lean: true} ),
                    DbOperations.aggregateData(ClinicPatient,aggregate),
                    DbOperations.count(Message, {locationId:payload.locationId,twilioSend:true, createdAt: { $gte: new Date(data.weekStart), $lte: new Date(data.weekEnd) }}),
                    DbOperations.count(Message, {locationId:payload.locationId,twilioSend:true, createdAt: { $gte: new Date(data.monthStart), $lte: new Date(data.monthEnd) }}),
                    DbOperations.count(Message, {locationId:payload.locationId,twilioSend:true, createdAt: { $gte: new Date(data.yearStart), $lte: new Date(data.yearEnd) }})
                ]);
                const totalPatientCount = totalPatient.length > 0 ? totalPatient.length : 0
                return resolve({locationData : locationData, totalPatient:totalPatientCount,weeklySms:weeklySms, monthlySms:monthlySms, yearlySms:yearlySms});
            } catch (err) {
                return reject(err);
            }
        })
    }
}


module.exports = AdminController;