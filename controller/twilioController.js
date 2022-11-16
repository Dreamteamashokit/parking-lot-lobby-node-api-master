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

if (!process.env.HIPPA_JOT_URL) {
  throw new Error("Missing enviornment variable: HIPPA_JOT_URL");
}
class TwilioController {
  static async sms(payloadData) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!payloadData.From) {
          throw { status: 400, message: "Missing your phone number." };
        }
        const locationExist = await DbOperations.findOne(
          locationSchema,
          { twilioNumber: payloadData.To },
          {},
          { lean: true }
        );
        if (!locationExist) {
          throw {
            status: 400,
            message: "No location found for this twilio number.",
          };
        }
        let message_body = payloadData.Body || "";
        payloadData.Body = message_body.toLowerCase();
        const checkPhoneExist = await DbOperations.findOne(
          User,
          { fullNumber: payloadData.From },
          {},
          { lean: true }
        );
        const { updatedDate } = await commonFunctions.subtractMinutes(10);
        if (!checkPhoneExist) {
          const payload = {
            userType: 2,
            fullNumber: payloadData.From,
            FromCountry: payloadData.FromCountry || "",
            email: payloadData.From,
            locationId: locationExist._id,
            clinicId: locationExist.clinicId,
          };
          let response = await DbOperations.saveData(User, payload);
          const messageQuery = {
            patientId: response._id,
            clinicId: locationExist.clinicId,
            locationId: locationExist._id,
            createdAt: { $gte: new Date(updatedDate) },
          };
          const lastMessage = await DbOperations.count(Message, messageQuery);
          // console.log("\n lastMessage:", lastMessage);
          await commonFunctions.updateMessage(
            locationExist._id,
            locationExist.clinicId,
            response._id,
            message_body,
            1
          );
          // Note:- checkMessageBodyCase function replace with checkRequestedMessage for new flow
          const { reply, isUpdate } = await checkRequestedMessage(
            payloadData,
            response,
            locationExist._id,
            locationExist.clinicId,
            lastMessage
          );
          if (!reply) {
            return resolve(reply);
          }
          if (isUpdate)
            await commonFunctions.initialUpdateMessage(
              locationExist._id,
              locationExist.clinicId,
              response._id,
              reply,
              2
            );
          else
            await commonFunctions.updateMessage(
              locationExist._id,
              locationExist.clinicId,
              response._id,
              reply,
              2
            );

          return resolve(reply);
        } else {
          const messageQuery = {
            patientId: checkPhoneExist._id,
            clinicId: locationExist.clinicId,
            locationId: locationExist._id,
            createdAt: { $gte: new Date(updatedDate) },
          };
          const lastMessage = await DbOperations.count(Message, messageQuery);
          // console.log("\n else lastMessage:", lastMessage);
          await commonFunctions.updateMessage(
            locationExist._id,
            locationExist.clinicId,
            checkPhoneExist._id,
            message_body,
            1
          );
          // Note:- checkMessageBodyCase function replace with checkRequestedMessage for new flow
          const { reply, isUpdate } = await checkRequestedMessage(
            payloadData,
            checkPhoneExist,
            locationExist._id,
            locationExist.clinicId,
            lastMessage
          );
          if (!reply) {
            return resolve(reply);
          }
          if (isUpdate)
            await commonFunctions.initialUpdateMessage(
              locationExist._id,
              locationExist.clinicId,
              checkPhoneExist._id,
              reply,
              2
            );
          else
            await commonFunctions.updateMessage(
              locationExist._id,
              locationExist.clinicId,
              checkPhoneExist._id,
              reply,
              2
            );

          return resolve(reply);
        }
      } catch (err) {
        console.log("\n error in sms:", err);
        return reject(err);
      }
    });
  }
  static async send(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: commonFunctions.getErrorMessage("patientIdNotExist"),
          };
        }
        if (!payloadData.message) {
          throw { status: 400, message: "Missing required parameter: message" };
        }
        const patientPhoneNumber = await DbOperations.findOne(
          User,
          { _id: payloadData.patientId, userType: 2 },
          { fullNumber: 1 },
          { lean: true }
        );
        if (!patientPhoneNumber) {
          throw {
            status: 400,
            message: commonFunctions.getErrorMessage("patientNotFound"),
          };
        }
        const clinicLocationData = await DbOperations.findOne(
          locationSchema,
          { _id: userData.locationId },
          { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
          { lean: true }
        );
        if (!clinicLocationData || !clinicLocationData.twilioNumber) {
          throw new Error(
            "This clinic location has not any messages number.Contact to Admin."
          );
        }
        if (clinicLocationData?.allowSmsFeature) {
          const sendPayload = {
            to: patientPhoneNumber.fullNumber,
            from: clinicLocationData.twilioNumber,
            body: payloadData.message,
          };
          await commonFunctions.sendTwilioMessage(sendPayload);
          const response = await commonFunctions.updateMessage(
            clinicLocationData._id,
            clinicLocationData.clinicId,
            payloadData.patientId,
            payloadData.message,
            2,
            true
          );
          return resolve(response);
        } else {
          const response = await commonFunctions.updateMessage(
            clinicLocationData._id,
            clinicLocationData.clinicId,
            payloadData.patientId,
            payloadData.message,
            2,
            false
          );
          return resolve(response);
        }
      } catch (err) {
        console.log("\n error in controller:", err);
        return reject(err);
      }
    });
  }
  static async jotNotification(payload) {
    return new Promise(async (resolve, reject) => {
      let clinicPatient = null;
      try {
        const submissionID = payload.submissionID ? payload.submissionID : null;
        const FormId = payload.formID ? payload.formID : null;
        const rowData = JSON.parse(payload.rawRequest);
        //console.log("\n jotNotification rowData:", rowData);
        if (!submissionID || !FormId) {
          return reject({ message: "FormId or submissionID missing." });
        }

        const questions = await commonFunctions.getFormQuestions(FormId);
        if (!questions) {
          return reject({ message: "Jot Form questions missing." });
        }
        const userPayload = {};
        const clinicPayload = {
          uploadNotify: false,
          inQueue: true,
          inQueueAt: new Date(),
          submitPaperWork: true,
          submissionID: submissionID,
        };
        let clientPatientId = null;
        let parentPatientId = null;
        let phoneNumber = null;

        for (let [key, value] of Object.entries(questions)) {
          if (value && value.hasOwnProperty("name")) {
            let fieldName = value.name;
            //console.log("\n\n== fieldName :", fieldName)
            let qid = value.hasOwnProperty("qid") ? value.qid : 0;
            switch (fieldName) {
              case "whatParking":
                clinicPayload["parkingSpot"] = rowData[`q${qid}_whatParking`];
                break;
              case "hasPatient":
                const hasValue = rowData[`q${qid}_hasPatient`];
                userPayload["hasPatient"] =
                  hasValue && hasValue === "NO" ? 2 : 1;
                break;
              case "patientName":
                userPayload["first_name"] =
                  rowData[`q${qid}_patientName`]["first"];
                userPayload["last_name"] =
                  rowData[`q${qid}_patientName`]["last"];
                break;
              case "phoneNumber":
                phoneNumber = rowData[`q${qid}_phoneNumber`];
                break;
              case "dateOfBirth":
                if(rowData[`q${qid}_dateOfBirth`]) {
                  const year = rowData[`q${qid}_dateOfBirth`]["year"];
                  const month = rowData[`q${qid}_dateOfBirth`]["month"];
                  const day = rowData[`q${qid}_dateOfBirth`]["day"];
                  userPayload["dob"] = new Date(`${year}-${month}-${day}`);
                }
                break;
              case "dateOf":
                let dateOf = rowData[`q${qid}_dateOf`];
                if(dateOf) {
                  const [month, day, year] = dateOf.split('/');
                  userPayload["dob"] = new Date(`${year}-${month}-${day}`);
                }
                break;
              case "reasonFor":
                clinicPayload["visitReason"] = rowData[`q${qid}_reasonFor`];
                break;
              case "email":
                userPayload["email"] = rowData[`q${qid}_email`];
                break;
              case "insuranceCardUpdate":
                let in_field = rowData[`q${qid}_insuranceCardUpdate`];
                if (in_field && in_field !== "" && in_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "drivingLicenseFront":
                let df_field = rowData[`q${qid}_drivingLicenseFront`];
                if (df_field && df_field !== "" && df_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "drivingLicenseBack":
                let db_field = rowData[`q${qid}_drivingLicenseBack`];
                if (db_field && db_field !== "" && db_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "insuranceFront":
                let if_field = rowData[`q${qid}_insuranceFront`];
                if (if_field && if_field !== "" && if_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "secondaryInsuranceFront":
                let sif_field = rowData[`q${qid}_secondaryInsuranceFront`];
                if (sif_field && sif_field !== "" && sif_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "patientSecondaryInsuranceAdd":
                let ps_field = rowData[`q${qid}_patientSecondaryInsuranceAdd`];
                if (ps_field && ps_field !== "" && ps_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "secondaryInsuranceBack":
                let sib_field = rowData[`q${qid}_secondaryInsuranceBack`];
                if (sib_field && sib_field !== "" && sib_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "initials":
                let i_field = rowData[`q${qid}_initials`];
                if (i_field && i_field !== "" && i_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "signature":
                let s_field = rowData[`q${qid}_signature`];
                if (s_field && s_field !== "" && s_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "insuranceBack":
                let ib_field = rowData[`q${qid}_insuranceBack`];
                if (ib_field && ib_field !== "" && ib_field !== "")
                  clinicPayload["uploadNotify"] = true;
                break;
              case "clientPatientId":
                clientPatientId = rowData[`q${qid}_clientPatientId`];
                break;
              case "parentPatientId":
                parentPatientId = rowData[`q${qid}_parentPatientId`];
                break;
              case "gender":
                switch (rowData[`q${qid}_gender`]) {
                  case "Male":
                    userPayload.gender = 1;
                    break;
                  case "Female":
                    userPayload.gender = 2;
                    break;
                  case "Other":
                    userPayload.gender = 3;
                    break;
                  default:
                    userPayload.gender = 1;
                    break;
                }
                break;
              default:
                break;
            }
          }
        }
        if (parentPatientId) {
          const parentPatientData = await DbOperations.findOne(
            ClinicPatient,
            { _id: parentPatientId },
            {},
            { lean: true }
          );
          if (!parentPatientData) {
            return reject({
              message: "No parent patient found with parentPatientId.",
            });
          }
          const subPatientPayload = {
            first_name: userPayload.first_name ? userPayload.first_name : "",
            last_name: userPayload.last_name ? userPayload.last_name : "",
            email: userPayload.email ? userPayload.email : "",
            gender: userPayload.gender ? userPayload.gender : 1,
            dob: userPayload.dob ? userPayload.dob : new Date(),
            parentClientId: parentPatientId,
            submissionID: submissionID,
          };
          await DbOperations.saveData(SubPatientSchema, subPatientPayload);
          const clinicLocationData = await DbOperations.findOne(
            locationSchema,
            { _id: parentPatientData.locationId },
            { twilioNumber: 1, clinicId: 1, allowSmsFeature:1 },
            { lean: true }
          );
          let updatedUser = await DbOperations.findOne(
            User,
            (parentPatientData?.patientId ? { _id: parentPatientData.patientId } : { fullNumber: phoneNumber }),
            {},
            { lean: true }
          );
          if(!updatedUser) {
            updatedUser = await DbOperations.saveData(
              User,
              {...userPayload, fullNumber: phoneNumber }
            );
            clinicPayload['patientId'] = updatedUser._id;
          }
          let sendMessage = `${subPatientPayload.first_name} is Successfully added into your queue list`;
          if (clinicLocationData?.allowSmsFeature) {
            const sendPayload = {
              to: updatedUser?.fullNumber || phoneNumber,
              from: clinicLocationData.twilioNumber,
              body: sendMessage,
            };
            await commonFunctions.sendTwilioMessage(sendPayload);
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              updatedUser._id,
              sendMessage,
              2,
              true
            );
          } else {
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              updatedUser._id,
              sendMessage,
              2,
              false
            );
          }
          await DbOperations.findAndUpdate(
            ClinicPatient,
            {
              _id: parentPatientId,
            },
            {
              uploadNotify: true,
            }
          )
        } else {
          if (!clientPatientId)
            return reject({
              message: "No clientPatientid Found into jotform response.",
            });

          const isResubmit = await DbOperations.findOne(
            ClinicPatient,
            {
              _id: clientPatientId,
              submissionID: { $ne: null },
            },
            {},
            { lean: true }
          );
          if (isResubmit) {
            const user = await DbOperations.findOne(User, { _id: isResubmit.patientId }, {}, { lean: true });
            const location = await DbOperations.findOne(locationSchema, { _id: isResubmit.locationId }, {}, { lean: true });
            const sendPayload = {
              to: user.fullNumber,
              from: location.twilioNumber,
              body: `Your link is expired, please get new link by sending "Arrived" sms.`,
            };
            await commonFunctions.sendTwilioMessage(sendPayload);
            return reject({
              message: "Resubmission jotform.",
            });
          }

          const clientPatientData = await DbOperations.findOne(
            ClinicPatient,
            { _id: clientPatientId },
            {},
            { lean: true }
          );
          if (!clientPatientData) {
            return reject({ message: "No patient found with submissionId." });
          }
          clinicPatient = clientPatientData;
          
          let updatedUser = await DbOperations.findOne(
            User,
            (clientPatientData?.patientId ? { _id: clientPatientData.patientId } : { fullNumber: phoneNumber }),
            {},
            { lean: true }
          )
          if(!updatedUser) {
            updatedUser = await DbOperations.saveData(
              User,
              {...userPayload, fullNumber: phoneNumber }
            );
          }
          clinicPayload['patientId'] = updatedUser._id;
          await Promise.all([
            await DbOperations.findAndUpdate(
              ClinicPatient,
              {
                _id: clientPatientData._id,
                isCheckIn: false,
                isCheckOut: false,
              },
              clinicPayload
            ),
            await DbOperations.findAndUpdate(
              User,
              { _id: updatedUser._id },
              userPayload
            ),
          ]);
          const [
            clinicSetting,
            clinicLocationData,
            uploaded_files,
          ] = await Promise.all([
            DbOperations.findOne(
              settingSchema,
              { clinicId: clientPatientData.clinicId },
              {},
              {}
            ),
            DbOperations.findOne(
              locationSchema,
              { _id: clientPatientData.locationId },
              { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
              { lean: true }
            ),
            commonFunctions.getSubmission(submissionID),
          ]);
          const businessName =
            clinicSetting &&
            clinicSetting.businessInformation &&
            clinicSetting.businessInformation.companyName
              ? clinicSetting.businessInformation.companyName
              : "Our business";
          const userName = `${userPayload.first_name} ${userPayload.last_name}`;
          let sendMessage = await commonFunctions.getReplyMessage(
            "submit_paperwork",
            0,
            0,
            businessName,
            userName,
            0
          );
          if (clinicLocationData?.allowSmsFeature) {
            const sendPayload = {
              to: updatedUser?.fullNumber || phoneNumber,
              from: clinicLocationData.twilioNumber,
              body: sendMessage,
            };
            // console.log("\n on submit 1st jotform..", sendMessage);
            await Promise.all([
              commonFunctions.sendTwilioMessage(sendPayload),
              commonFunctions.updateMessage(
                clinicLocationData._id,
                clinicLocationData.clinicId,
                updatedUser._id,
                sendMessage,
                2,
                true
              ),
            ]);
          } else {
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              updatedUser._id,
              sendMessage,
              2,
              false
            );
          }

          io.sockets
            .to(`room_${clinicLocationData.clinicId}`)
            .emit("new-patient", {
              clientId: clinicLocationData.clinicId,
              locationId: clinicLocationData._id,
            });
          commonFunctions.updateMessage(
            clinicLocationData._id,
            clinicLocationData.clinicId,
            updatedUser._id,
            "patient has completed Paperwork.",
            1
          );
          if (uploaded_files && uploaded_files.length > 0) {
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              updatedUser._id,
              "patient uploaded file over jotfrom.",
              1
            );
          }
        }
        //const isFieldDataEmpty = await commonFunctions.IsEmpty(userPayload);

        /* if (isFieldDataEmpty) {
                    await DbOperations.findAndUpdate(ClinicPatient, { _id: clientPatientData._id, isCheckIn: false, isCheckOut: false }, clinicPayload);
                } else { */

        //}
        return resolve(true);
      } catch (error) {
        console.log(error);
        logger.error({path: 'twillio controller 547', error: error.message || error})
        if (error.name === "MongoError" && error.code === 11000) {
          return reject(
            new Error(
              "email must be unique. THis email already exist into our system."
            )
          );
        } else {
          if (!clinicPatient) {
            return reject(error);
          }
          const [userData, clinicLocationData] = await Promise.all([
            DbOperations.findOne(
              User,
              { _id: clinicPatient.patientId },
              {},
              { lean: true }
            ),
            DbOperations.findOne(
              locationSchema,
              { _id: clinicPatient.locationId },
              { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
              { lean: true }
            ),
          ]);
          if (!userData) return reject(error);
          const sendMessage = error.message
            ? `During save jotform info follow error occur: ${error.message} . Please contact to clinic.`
            : "Something went wrong during submit your basic info.Please try again with same link.";
          if (error.code && error.code === 21610) {
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              userData._id,
              sendMessage,
              2
            );
          } else {
            if (clinicLocationData?.allowSmsFeature) {
              const sendPayload = {
                to: userData?.fullNumber || phoneNumber,
                from: clinicLocationData.twilioNumber,
                body: sendMessage,
              };
              await Promise.all([
                commonFunctions.sendTwilioMessage(sendPayload),
                commonFunctions.updateMessage(
                  clinicLocationData._id,
                  clinicLocationData.clinicId,
                  userData._id,
                  sendMessage,
                  2,
                  true
                ),
              ]);
            } else {
              await commonFunctions.updateMessage(
                clinicLocationData._id,
                clinicLocationData.clinicId,
                userData._id,
                sendMessage,
                2,
                false
              );
            }
          }
          return reject(error);
        }
      }
    });
  }
  static async qrAppointment(locationId) {
    return new Promise(async (resolve, reject) => {
      try {
        const [clinicLocationData] = await Promise.all([
          DbOperations.findOne(
            locationSchema,
            { _id: locationId },
            {},
            { lean: true }
          ),
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
        const clinicPayload = {
          locationId: locationId,
          clinicId: clinicLocationData.clinicId,
          submissionID: null,
          visitDate: new Date(),
          inQueue: false,
        };
        let savedRecord = await DbOperations.saveData(
          ClinicPatient,
          clinicPayload
        );
        const responseJotFormUrl = await jotFormSubmit(savedRecord._id);
        return resolve({
          url: responseJotFormUrl,
        });
      } catch (error) {
        reject(error)
      }
    });
  }
}

module.exports = TwilioController;
/*-----------------Helper Functions --------------*/
async function checkRequestedMessage(
  payloadData,
  patientData,
  locationId,
  clinicId,
  lastMessageCount
) {
  return new Promise(async (resolve) => {
    try {
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
      //------When Patient already Checkout ----//
      if (checkoutPatient) {
        if (lowerCaseBody && isNaN(lowerCaseBody)) {
          return resolve({
            reply: "Please send a digit between 1-10.",
            isUpdate: false,
          });
        } else if (lowerCaseBody) {
          const scalePoint = parseInt(lowerCaseBody);
          let firstName =
            patientData && patientData.first_name ? patientData.first_name : "";
          let lastName =
            patientData && patientData.last_name ? patientData.last_name : "";
          const full_name = `${firstName} ${lastName}`;
          await DbOperations.findAndUpdate(
            ClinicPatient,
            { _id: checkoutPatient._id },
            { waitingForReview: false },
            { new: true }
          );
          if (checkReviewExist) {
            await DbOperations.findAndUpdate(
              reviewSchema,
              { _id: checkReviewExist._id },
              { point: scalePoint },
              { new: true }
            );
          } else {
            await DbOperations.saveData(reviewSchema, {
              point: scalePoint,
              patientId: patientData._id,
              locationId: locationId,
            });
          }
          if (scalePoint < 8) {
            const reviewLink = `${baseUrl}/review/${locationId}/${patientData._id}`;
            const defaultMessage = await commonFunctions.getReplyMessage(
              "reviewMessage",
              0,
              0,
              business,
              full_name,
              0,
              reviewLink
            );
            return resolve({
              reply: defaultMessage,
              isUpdate: false,
            });
          } else {
            const business =
              clinicSetting &&
              clinicSetting.businessInformation &&
              clinicSetting.businessInformation.companyName
                ? clinicSetting.businessInformation.companyName
                : "Our business";
            const { status, message } =
              await commonFunctions.checkSettingAndUpdateMessage(
                "reviewLinkAlert",
                clinicId,
                patientData,
                locationId
              );
            const defaultMessage = await commonFunctions.getReplyMessage(
              "customReview",
              0,
              0,
              business,
              full_name,
              0,
              "https://www.facebook.com/pg/matrixmarketers/reviews/"
            );
            const sendMessage = status ? message : defaultMessage;
            return resolve({
              reply: sendMessage,
              isUpdate: false,
            });
          }
        } else {
          return resolve({
            reply: commonFunctions.getReplyMessage("empty"),
            isUpdate: false,
          });
        }
      } else if (lowerCaseBody === "status") {
        const response = await updatePatientStatus(locationId, patientData._id);
        if (!response.status) {
          return resolve({
            reply: null,
            isUpdate: false,
          });
        }

        return resolve({
          reply: response.message,
          isUpdate: false,
        });
      } else {
        const keywords = [
          "arrive",
          "arrived",
          "here",
          "i'm here",
          "im here",
          "i’m here",
          "hi. i am here",
          "hi i’m here",
          "i am waiting outside",
          "i am outside",
          "i am outside waiting",
          "checkin",
        ];
        let isMatch = false;
        for (let i = 0; i < keywords.length; i++) {
          if (lowerCaseBody.includes(keywords[i])) {
            isMatch = true;
            break;
          }
        }
        if (isMatch) {
          const messageQuery = {
            type: 2,
            initial_message: true,
            patientId: patientData._id,
            clinicId: clinicId,
            locationId: locationId,
            createdAt: { $gte: new Date(start), $lte: new Date(end) },
          };
          const clinicQuery = {
            locationId: locationId,
            clinicId: clinicId,
            patientId: patientData._id,
            submissionID: null,
            visitDate: { $gte: new Date(start), $lte: new Date(end) },
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
            // DbOperations.findOne(
            //   ClinicPatient,
            //   clinicQuery,
            //   {},
            //   { lean: true }
            // ),
            commonFunctions.fetchJotformId(locationId),
            null,
            // DbOperations.findOne(Message, messageQuery),
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
          //let sendMessage = `Welcome - Please remain in your car and let us know you are here at ${business} by tapping the link below and filling out the form(note that this link is only for todays date which is ${formatedDate}): ${baseUrl}/patient/${locationId}/${patientID}`;
          const clinicPayload = {
            ...clinicQuery,
            inQueue: false,
            //submissionID: submissionId
          };
          delete clinicPayload.visitDate;
          if (!existClinicPatient) {
            clinicPayload["visitDate"] = new Date();
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
            let sendMessage = `Welcome - Please remain in your car and let us know you are here at ${business} by tapping the link below and filling out the form(note that this link is only for todays date which is ${formatedDate}): ${responseJotFormUrl}`;
            // console.log("\n sendMessage:", sendMessage);
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
            let sendMessage = `Welcome - Please remain in your car and let us know you are here at ${business} by tapping the link below and filling out the form (note that this link is only for todays date which is ${formatedDate}): ${responseJotFormUrl}`;
            // console.log("\n sendMessage:", sendMessage);
            return resolve({
              reply: sendMessage,
              isUpdate: true,
            });
          }
        } else {
          // here set logic for 10 min interval
          let replyMessage = commonFunctions.getReplyMessage("no_match");
          if (lastMessageCount > 0) {
            replyMessage = null;
          }
          return resolve({
            reply: replyMessage,
            isUpdate: false,
          });
        }
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
      // const encodedPatientNumber = encodeURIComponent("phoneNumber"),
      //   encodedLocationId = encodeURIComponent("location_id"),
      //   encodedClientPatientId = encodeURIComponent("clientPatientId");

      // const jotFormUrl = `${process.env.HIPPA_JOT_URL}/${JotFormId}?${encodedPatientNumber}=${fullNumber}&${encodedLocationId}=${locationId}&${encodedClientPatientId}=${patientId}`;
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

async function updatePatientStatus(locationId, patientDataId) {
  return new Promise(async (resolve) => {
    try {
      let message = null;
      if (!locationId || !patientDataId)
        return resolve({ status: false, message: message });

      const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
      let queryPayload = {
        locationId: locationId,
        visitDate: { $gte: new Date(start), $lte: new Date(end) },
        inQueue: true,
        isCancel: false,
        isCheckIn: false,
        isCheckOut: false,
        is_block: false,
        is_delete: { $ne: true },
      };
      let aggregate = [
        { $match: queryPayload },
        {
          $lookup: {
            from: "users",
            localField: "patientId",
            foreignField: "_id",
            as: "patientData",
          },
        },
        { $unwind: { path: "$patientData" } },
        {
          $project: {
            _id: 1,
            inQueueAt: 1,
            patientId: {
              _id: "$patientData._id",
              fullNumber: "$patientData.fullNumber",
              email: "$patientData.email",
              first_name: "$patientData.first_name",
              last_name: "$patientData.last_name",
            },
          },
        },
        { $sort: { inQueueAt: 1 } },
      ];
      const [existClinicPatient, totalPatients] = await Promise.all([
        DbOperations.aggregateData(ClinicPatient, aggregate),
        DbOperations.count(ClinicPatient, queryPayload),
      ]);
      if (existClinicPatient && existClinicPatient.length > 0) {
        for (let p = 0; p < existClinicPatient.length; p++) {
          if (
            existClinicPatient[p].patientId._id.toString() ===
            patientDataId.toString()
          ) {
            const statusMessage = await commonFunctions.getReplyMessage(
              "status",
              p + 1,
              totalPatients
            );
            message = statusMessage;
            break;
          }
        }
      }
      return resolve({ status: true, message: message });
    } catch (e) {
      console.log("\n err:", err);
      return resolve({ status: false, message: message });
    }
  });
}

/*
static async jotPaperWorkNotification(submissionID, secondFormID) {
        return new Promise(async (resolve, reject) => {
            try {
                const clientPatientData = await DbOperations.findOne(ClinicPatient, { submissionID: submissionID }, {}, { lean: true });
                if (!clientPatientData) {
                    return reject({ message: 'No patient found with submissionId.' })
                }
                if (clientPatientData.submitPaperWork) {
                    return resolve(true);
                }
                const [patientData, clinicSetting, clinicLocationData] = await Promise.all([
                    DbOperations.findOne(User, { _id: clientPatientData.patientId }, { first_name: 1, last_name: 1, fullNumber: 1 }, { lean: true }),
                    DbOperations.findOne(settingSchema, { clinicId: clientPatientData.clinicId }, {}, {}),
                    DbOperations.findOne(locationSchema, { _id: clientPatientData.locationId }, { twilioNumber: 1, clinicId: 1, allowSmsFeature:1 }, { lean: true }),
                ])
                const business = (clinicSetting && clinicSetting.businessInformation && clinicSetting.businessInformation.companyName) ? clinicSetting.businessInformation.companyName : "Our business"
                let firstName = (patientData && patientData.first_name) ? patientData.first_name : '',
                    lastName = (patientData && patientData.last_name) ? patientData.last_name : '',
                    userName = firstName + ' ' + lastName;
                let defaultMessage = await commonFunctions.getReplyMessage('submit_paperwork', 0, 0, business, userName, 0);
                if (defaultMessage) {
                    if(clinicLocationData?.allowSmsFeature) {
                        const sendPayload = {
                            to: patientData.fullNumber,
                            from: clinicLocationData.twilioNumber,
                            body: defaultMessage,
                        }
                        await Promise.all([
                            commonFunctions.sendTwilioMessage(sendPayload),
                            commonFunctions.updateMessage(clinicLocationData._id, clinicLocationData.clinicId, clientPatientData._id, defaultMessage, 2, true)
                        ])
                    } else {
                        await commonFunctions.updateMessage(clinicLocationData._id, clinicLocationData.clinicId, clientPatientData._id, defaultMessage, 2, false)
                    }
                }
                // notify when second form data submitte
                io.sockets.to(`room_${clinicLocationData.clinicId}`).emit('new-patient', { clientId: clinicLocationData.clinicId, locationId: clinicLocationData._id });
                await Promise.all([
                    DbOperations.findAndUpdate(ClinicPatient, { _id: clientPatientData._id }, { submitPaperWork: true, paperWorkSubmissionId: secondFormID, uploadNotify: true }, { new: true }),
                    commonFunctions.updateMessage(clinicLocationData._id, clinicLocationData.clinicId, clientPatientData.patientId, 'patient has completed Paperwork.', 1)
                ])
                return resolve(true);
            } catch (err) {
                return reject(err);
            }
        });
    }
*/
