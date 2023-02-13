import {
  User,
  settingSchema,
  ClinicPatient,
  locationSchema,
  Message,
  reviewSchema,
  SubPatientSchema,
} from "../models";
import { DbOperations, commonFunctions, logger } from "../services";
import moment from 'moment';
const twilio = require('twilio');
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  
  if (!process.env.HIPPA_JOT_URL) {
    throw new Error("Missing enviornment variable: HIPPA_JOT_URL");
  }
  class ScheduleAppointmentController {
    static async scheduleAppointmentMethod(payloadData) {
      return new Promise(async (resolve, reject) => {
        try {
          //console.log(payloadData);
          console.log("line numner 22");
          if (!payloadData.mobile) {
            throw { status: 400, message: "Missing your phone number." };
          }
          console.log("line numner 26");
          const locationExist = await DbOperations.findOne(
            locationSchema,
            { _id: payloadData.locationId },
            {},
            { lean: true }
          );
          console.log("line numner 33");
          if (!locationExist) {
            throw {
              status: 400,
              message: "No location found for this twilio number.",
            };
          }
          console.log("line numner 40");
          let message_body = payloadData.Body || "";
          payloadData.Body = message_body.toLowerCase();
          const checkPhoneExist = await DbOperations.findOne(
            User,
            { fullNumber: payloadData.mobile },
            {},
            { lean: true }
          );
          console.log("line numner 49");
          if (!checkPhoneExist) {
            const payload = {
              userType: 2,
              fullNumber: payloadData.mobile,
              FromCountry: payloadData.FromCountry || "",
              dob: new Date(payloadData.dob),
              first_name:payloadData.FirstName,
              last_name:payloadData.LastName,
              locationId: locationExist._id,
              clinicId: locationExist.clinicId,
            };
            console.log("line numner 60");
            let response = await DbOperations.saveData(User, payload);
            const { reply, isUpdate } = await checkRequestedMessage(
              payloadData,
              response,
              locationExist._id,
              locationExist.clinicId
            );
            console.log("line numner 68");
            if (!reply) {
              return resolve(reply);
            }
            
            return resolve(reply);
          } else {
            console.log("line numner 75");
            const { reply, isUpdate } = await checkRequestedMessage(
              payloadData,
              checkPhoneExist,
              locationExist._id,
              locationExist.clinicId,
              null
            );
            if (!reply) {
              return resolve(reply);
            }
            
            return resolve(reply);
          }
        } catch (err) {
          console.log("\n error in scheduleAppointmentMethod:", err);
          return reject(err);
        }
      });
    }
    
  }
  
  module.exports = ScheduleAppointmentController;
  /*-----------------Helper Functions --------------*/
  async function checkRequestedMessage(
    payloadData,
    patientData,
    locationId,
    clinicId
  ) {
    return new Promise(async (resolve) => {
      try {
        console.log('payloadData',payloadData);
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay(); 
        const checkoutQuery = {
          locationId: locationId,
          clinicId: clinicId,
          patientId: patientData._id,
          visitDate: { $gte: new Date(start), $lte: new Date(end) },
          isCheckOut: true,
          waitingForReview: true,
        };
        const reviewQuery = {
          patientId: patientData._id,
          locationId: locationId,
          createdAt: { $gte: new Date(start), $lte: new Date(end) },
        };
        const [clinicSetting, checkoutPatient, baseUrl, checkReviewExist] =
        await Promise.all([
          DbOperations.findOne(settingSchema, { clinicId: clinicId }, {}, {}),
          DbOperations.findOne(
            ClinicPatient,
            checkoutQuery,
            {},
            { lean: true }
          ),
          commonFunctions.getEnvVariable("WEBSITE_URL"),
          DbOperations.findOne(
            reviewSchema,
            reviewQuery,
            { _id: 1 },
            { lean: true }
          ),
        ]);
      const lowerCaseBody = payloadData.Body || "";
      const business =
        clinicSetting &&
        clinicSetting.businessInformation &&
        clinicSetting.businessInformation.companyName
          ? clinicSetting.businessInformation.companyName
          : "Our business";
            const clinicQuery = {
              locationId: locationId,
              clinicId: clinicId,
              patientId: patientData._id,
              submissionID: null,
              visitDate: { $gte: new Date(start), $lte: new Date(end) },
              scheduleByUser:true,
              inQueue: true,
            };
            const [
              clinicLocationData,
              existClinicPatient,
              clinicJotFormId,
              alreadyMessageSend,
            ] = await Promise.all([
              DbOperations.findOne(
                locationSchema,
                { _id: locationId },
                {},
                { lean: true }
              ),
              null,
              commonFunctions.fetchJotformId(locationId),
              null
            ]);
            if (!clinicLocationData) {
              throw new Error(commonFunctions.getErrorMessage("clinicNotFound"));
            } else if (!clinicLocationData.twilioNumber) {
              throw new Error(
                commonFunctions.getErrorMessage("clinicContactNotFound")
              );
            }
  
            if (!clinicLocationData.isOpen) {
              const { status, message } =
                await commonFunctions.checkSettingAndUpdateMessage(
                  "companyOffAlert",
                  clinicId,
                  patientData,
                  locationId
                );
              const defaultMessage = "Please call our office number.";
              const sendMessage = status ? message : defaultMessage;
              return resolve({
                reply: sendMessage,
                isUpdate: false,
              });
            }
            //-----------when we already sent message to patient reapeat same message again
            if (alreadyMessageSend) {
              return resolve({
                reply: alreadyMessageSend.content || "",
                isUpdate: false,
              });
            }
  
            const formatedDate = start.format("MM/DD/YYYY");
            // let visitDateRaw = new Date(payloadData.visitDate);
            let visitDateFormated = moment(new Date(payloadData.visitDate)).format("MM/DD/YYYY");
            //let sendMessage = `Welcome - Please remain in your car and let us know you are here at ${business} by tapping the link below and filling out the form(note that this link is only for todays date which is ${formatedDate}): ${baseUrl}/patient/${locationId}/${patientID}`;
            const clinicPayload = {
              ...clinicQuery,
              inQueue: false,
              //submissionID: submissionId
            };
            delete clinicPayload.visitDate;
            if (!existClinicPatient) {
              clinicPayload["visitDate"] = new Date(payloadData.visitDate);
              clinicPayload["visitReason"] = new Date(payloadData.visitReason);
              
              let savedRecord = await DbOperations.saveData(
                ClinicPatient,
                clinicPayload
              );
              logger.dump({path: 'twillio controller: 870', body: clinicPayload})
              savedRecord = await DbOperations.findOne(
                ClinicPatient,
                { _id: savedRecord._id },
                {},
                { lean: true }
              );
              logger.dump({path: 'twillio controller: 877', body: savedRecord})
              if(!savedRecord) {
                logger.dump({path: 'twillio controller: 879', body: savedRecord})
                try {
                  savedRecord = await new Promise((resolve, reject) => {
                    const record = new ClinicPatient(clinicPayload);
                    record.save(function (err, el) {
                      if (err) return reject(err);
                      resolve(el)
                    });
                  })
                } catch (error) {
                  console.log("\n err:", err);
                  logger.error({path: 'twillio controller: 887', error});
                  return resolve({
                    reply: commonFunctions.getReplyMessage("no_respond"),
                    isUpdate: false,
                  });
                }
                savedRecord = await DbOperations.findOne(
                  ClinicPatient,
                  { _id: savedRecord._id , is_delete: { $ne: true } },
                  {},
                  { lean: true }
                );
              }
              if(!savedRecord) {
                logger.error({path: 'twillio controller: 902', error});
                return resolve({
                  reply: commonFunctions.getReplyMessage("no_respond"),
                  isUpdate: false,
                });
              }
              // here we will add field with url and send due to hippa security on edit
              const responseJotFormUrl = await jotFormSubmit(
                savedRecord._id,
              );
              let sendMessage = `Welcome - Your appoitment has been booked at ${business} for ${visitDateFormated}): ${responseJotFormUrl}. Note : Please fill the form once you reached to Clinic`;
              // console.log("\n sendMessage:", sendMessage);
              const data = await client.messages.create({
                body:sendMessage,
                to: `${payloadData.mobile}`, // Text this number
                from:process.env.TWILIO_NUMBER,
             })
             console.log(data);
              return resolve({
                reply: sendMessage,
                isUpdate: true,
              });
            } else {
              await DbOperations.findAndUpdate(
                ClinicPatient,
                { _id: existClinicPatient._id },
                clinicPayload
              );
              logger.dump({path: 'twillio route: 890', body: clinicPayload, existClinicPatient})
              // here we will add field with url and send due to hippa security on edit
              const responseJotFormUrl = await jotFormSubmit(
                existClinicPatient._id,
              );
              let sendMessage = `Welcome - Your appoitment has been booked at ${business} for ${visitDateFormated}): ${responseJotFormUrl}. Note : Please fill the form once you reached to Clinic`;
              // console.log("\n sendMessage:", sendMessage);
              const data = await client.messages.create({
                body:sendMessage,
                to: `${payloadData.mobile}`, // Text this number
                from:process.env.TWILIO_NUMBER,
             })
             console.log(data);
              return resolve({
                reply: sendMessage,
                isUpdate: true,
              });
            }
          
      } catch (err) {
        logger.error({path: 'twillio controller 941', error: err.message || err})
        console.log("\n err:", err);
        return resolve({
          reply: commonFunctions.getReplyMessage("no_match"),
          isUpdate: false,
        });
      }
    });
  }
  
  async function jotFormSubmit(patientId) {
    return new Promise(async (resolve, reject) => {
      try {
        const host = process.env.API_URL || 'https://api.parkinglotlobby.com';
        const jotFormUrl = `${host}/jotform/${patientId}`;
        logger.dump({path: 'twillio controller: 934', jotFormUrl})
        const { status, message, short_response } =
          await commonFunctions.shorterUrl(jotFormUrl);
        if (!status) {
          // console.log("when bitly no status:", message);
          return resolve(encodeURI(jotFormUrl));
        }
        // console.log("\n\n when bitly status :", short_response);
        const short_url =
          short_response && short_response.link
            ? short_response.link
            : jotFormUrl;
        return resolve(encodeURI(short_url));
      } catch (err) {
        logger.error({path: 'twillio controller 946', jotFormUrl, error: err.message || err})
        console.log("\n twilio jotform err:", err);
        return reject(err);
      }
    });
  }
