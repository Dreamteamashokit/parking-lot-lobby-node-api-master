"use strict";
import cron from "node-cron";
import {
  User,
  settingSchema,
  ClinicPatient,
  locationSchema,
  Message,
} from "../models";
import commonFunctions from "./commonFunctions";
import DBoperations from "./DBoperations";
import moment from "moment";
import mongoose from 'mongoose';

if (!process.env.HIPPA_JOT_URL) {
  throw new Error("Missing enviornment variable: HIPPA_JOT_URL");
}
const paperWorkSubmitTime = 15; // minutes
// Run after every 10 seconds
const checkAndNotifyPatient = function () {
  return cron.schedule("*/10 * * * * *", async () => {
    try {
      const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
      const queryPayload = {
        isNotify: true,
        isCheckIn: false,
        isCheckOut: false,
        notifyTime: { $exists: true },
        visitDate: { $gte: new Date(start), $lte: new Date(end) },
        clientSmsNotify: false,
      };
      const populateQuery = [
        {
          path: "clinicId",
          select: {
            _id: 1,
            fullNumber: 1,
            first_name: 1,
            last_name: 1,
          },
        },
        {
          path: "patientId",
          select: {
            _id: 1,
            fullNumber: 1,
            first_name: 1,
            last_name: 1,
          },
        },
        {
          path: "locationId",
          select: {
            _id: 1,
            twilioNumber: 1,
            clinicId: 1,
          },
        },
      ];
      let selectedFields = {
        _id: 1,
        clinicId: 1,
        locationId: 1,
        patientId: 1,
        notifyTime: 1,
        notifyAt: 1,
        clientSmsNotify: 1,
      };
      const patientData = await DBoperations.getData(
        ClinicPatient,
        queryPayload,
        selectedFields,
        { lean: true },
        populateQuery
      );
      if (patientData && patientData.length > 0) {
        for (let i = 0; i < patientData.length; i++) {
          let singlePatientData = patientData[i];
          if (
            moment(new Date(singlePatientData.notifyAt)).unix() <=
            moment(new Date()).unix()
          ) {
            await Promise.all([
              sendMessageToPatient(
                singlePatientData.clinicId,
                singlePatientData.patientId,
                singlePatientData.locationId
              ),
              DBoperations.findAndUpdate(
                ClinicPatient,
                { _id: singlePatientData._id },
                { clientSmsNotify: true },
                { new: true }
              ),
            ]);
          }
        }
      }
    } catch (err) {
      console.log("\n error in checkAndNotifyPatient:", err.message || err);
    }
  });
};
// run every day at 12 am
const updateUserAtTheEndOfDay = function () {
  return cron.schedule(
    "0 23 * * *",
    async () => {
      try {
        await DBoperations.updateMany(
          User,
          {
            $or: [
              { isChangeNameRequest: true },
              { isParkingSpotRequest: true },
            ],
          },
          { isParkingSpotRequest: false, isChangeNameRequest: false },
          { new: true }
        );
      } catch (err) {
        console.log(
          "\n error in updateUserAtTheEndOfDay cron:",
          err.message || err
        );
      }
    },
    {
      timezone: "America/New_York",
    }
  );
};
const updateParkingSpot = function () {
  return cron.schedule("* * * * *", async () => {
    try {
      const patientData = await DBoperations.findAll(
        User,
        { isParkingSpotRequest: true, userType: 2 },
        { atRequestForParkingSpot: 1 },
        { lean: true }
      );
      if (patientData && patientData.length > 0) {
        for (let i = 0; i < patientData.length; i++) {
          if (patientData[i].atRequestForParkingSpot) {
            let diffenceFromCurrent = await diff_minutes(
              new Date(patientData[i].atRequestForParkingSpot),
              new Date()
            );
            if (diffenceFromCurrent > 3) {
              await DBoperations.findAndUpdate(
                User,
                { _id: patientData[i]._id },
                { isParkingSpotRequest: false }
              );
            }
          }
        }
      }
    } catch (err) {
      console.log("\n error in updateParkingSpot cron:", err.message || err);
    }
  });
};
const updateNameChangeRequest = function () {
  return cron.schedule("* * * * *", async () => {
    try {
      const patientData = await DBoperations.findAll(
        User,
        { isChangeNameRequest: true, userType: 2 },
        { onNameChangeRequest: 1 },
        { lean: true }
      );
      if (patientData && patientData.length > 0) {
        for (let i = 0; i < patientData.length; i++) {
          if (patientData[i].onNameChangeRequest) {
            let diffenceFromCurrent = await diff_minutes(
              new Date(patientData[i].onNameChangeRequest),
              new Date()
            );
            if (diffenceFromCurrent > 3) {
              await DBoperations.findAndUpdate(
                User,
                { _id: patientData[i]._id },
                { isChangeNameRequest: false }
              );
            }
          }
        }
      }
    } catch (err) {
      console.log(
        "\n error in updateNameChangeRequest cron:",
        err.message || err
      );
    }
  });
};
// Run after every 10 seconds
const checkPaperworkAndReminder = function () {
  return cron.schedule("*/10 * * * * *", async () => {
    try {
      const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
      const queryPayload = {
        inQueue: true,
        isCheckIn: false,
        isCheckOut: false,
        visitDate: { $gte: new Date(start), $lte: new Date(end) },
        submitPaperWork: false,
        paperworkNotify: false,
      };
      const populateQuery = [
        {
          path: "clinicId",
          select: {
            _id: 1,
            fullNumber: 1,
            first_name: 1,
            last_name: 1,
          },
        },
        {
          path: "patientId",
          select: {
            _id: 1,
            fullNumber: 1,
            first_name: 1,
            last_name: 1,
          },
        },
        {
          path: "locationId",
          select: {
            _id: 1,
            twilioNumber: 1,
            clinicId: 1,
            allowSmsFeature: 1,
          },
        },
      ];
      let selectedFields = {
        _id: 1,
        clinicId: 1,
        locationId: 1,
        patientId: 1,
        submitPaperWork: 1,
        createdAt: 1,
        submissionID: 1,
        paperworkNotify: 1,
      };
      const patientData = await DBoperations.getData(
        ClinicPatient,
        queryPayload,
        selectedFields,
        { lean: true },
        populateQuery
      );
      if (patientData && patientData.length > 0) {
        for (let i = 0; i < patientData.length; i++) {
          let singlePatientData = patientData[i];
          let diffenceFromCurrent = await diff_minutes(
            new Date(singlePatientData.createdAt),
            new Date()
          );
          if (diffenceFromCurrent > paperWorkSubmitTime) {
            await Promise.all([
              sendPaperWorkReminder(
                singlePatientData.patientId,
                singlePatientData.locationId,
                singlePatientData.submissionID
              ),
              DBoperations.findAndUpdate(
                ClinicPatient,
                { _id: singlePatientData._id },
                { paperworkNotify: true },
                { new: true }
              ),
            ]);
          }
        }
      }
    } catch (err) {
      console.log("\n error in checkAndNotifyPatient:", err.message || err);
    }
  });
};
// Run every Minute
const checkProvidernotAtDesk = function () {
  return cron.schedule("* * * * *", async () => {
    try {
      const clinicLocationsData = await DBoperations.findAll(
        locationSchema,
        {
          isActive: true,
          isOpen: true,
          twilioNumber: { $exists: true, $ne: null },
        },
        {},
        { lean: true }
      );
      if (clinicLocationsData && clinicLocationsData.length > 0) {
        const locationIds = [];
        for (let i = 0; i < clinicLocationsData.length; i++) {
          locationIds.push(clinicLocationsData[i]._id);
        }
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        const patientFortheDay = await DBoperations.findAll(ClinicPatient, {
          locationId: { $in: locationIds },
          inQueue: true,
          clinicOffNotify: false,
          visitDate: { $gte: new Date(start), $lte: new Date(end) },
        });
        if (patientFortheDay && patientFortheDay.length > 0) {
          for (let j = 0; j < patientFortheDay.length; j++) {
            //console.log("\n\n=== patientFortheDay", patientFortheDay)
            const patientData = await DBoperations.findOne(
              User,
              { _id: patientFortheDay[j].patientId, userType: 2 },
              {},
              { lean: true }
            );
            const companySettings =
              await commonFunctions.checkSettingAndUpdateMessage(
                "providerNotAtDeskAlert",
                patientFortheDay[j].clinicId,
                patientData,
                patientFortheDay[j].locationId
              );
            if (companySettings.status) {
              if (patientFortheDay[j].inQueueAt) {
                const messageQuery = {
                  initial_message: true,
                  type: 2,
                  patientId: patientFortheDay[j].patientId,
                  clinicId: patientFortheDay[j].clinicId,
                  locationId: patientFortheDay[j].locationId,
                  createdAt: { $gte: new Date(start), $lte: new Date(end) },
                };
                const intialMessage = await DBoperations.findOne(
                  Message,
                  messageQuery,
                  {},
                  { lean: true }
                );
                if (intialMessage) {
                  let diffenceFromCurrent = await diff_minutes(
                    new Date(patientFortheDay[j].inQueueAt),
                    new Date()
                  );
                  console.log("diffenceFromCurrent:", diffenceFromCurrent);
                  if (diffenceFromCurrent > companySettings.certainTime) {
                    const clinicLocationData = await DBoperations.findOne(
                      locationSchema,
                      { _id: patientFortheDay[j].locationId },
                      { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
                      { lean: true }
                    );
                    if (clinicLocationData && clinicLocationData.twilioNumber) {
                      if (clinicLocationData?.allowSmsFeature) {
                        const sendPayload = {
                          to: patientData.fullNumber,
                          from: clinicLocationData.twilioNumber,
                          body: companySettings.message,
                        };
                        console.log("sendPayload:", sendPayload);
                        await commonFunctions.sendTwilioMessage(sendPayload);
                        await commonFunctions.updateMessage(
                          patientFortheDay[j].locationId,
                          patientFortheDay[j].clinicId,
                          patientFortheDay[j].patientId,
                          companySettings.message,
                          2,
                          true
                        );
                      } else {
                        await commonFunctions.updateMessage(
                          patientFortheDay[j].locationId,
                          patientFortheDay[j].clinicId,
                          patientFortheDay[j].patientId,
                          companySettings.message,
                          2,
                          false
                        );
                      }
                      await DBoperations.findAndUpdate(
                        ClinicPatient,
                        { _id: patientFortheDay[j]._id },
                        { clinicOffNotify: true }
                      );
                    }
                  }
                }
              }
            }
          }
        }
        return true;
      }
      return true;
    } catch (err) {
      console.log("\n error in checkInProviderNotAtDesk:", err.message || err);
    }
  });
};
// Run every Minute
const scheduleClinicOpening = function () {
  return cron.schedule("* * * * *", async () => {
    try {
      const clinicLocationsData = await DBoperations.findAll(locationSchema, {
          isActive: true,
          isScheduleOpen: true,
        },
        {},
        {}
      );
      const isDateMatch = (scheduleTime, offset) => {
        const currentTime = moment().utcOffset(offset).format('HH:mm');
        return scheduleTime === currentTime
      }
      const emitOpening = (clinic, isOpen) => {
        io.sockets
            .to(`room_${clinic.clinicId}`)
            .emit("location-open", {
                clientId: clinic.clinicId,
                locationId: clinic._id,
                isOpen,
            });
      }
      for (const clinic of clinicLocationsData) {
        if(isDateMatch(clinic.openingTime, clinic.selectedTimeZone.offset)) {
          emitOpening(clinic, true);
          await DBoperations.findAndUpdate(locationSchema,{_id: mongoose.Types.ObjectId(clinic._id)},{isOpen: true}, {});
        } else if(isDateMatch(clinic.closingTime, clinic.selectedTimeZone.offset)) {
          emitOpening(clinic, false);
          await DBoperations.findAndUpdate(locationSchema,{_id: mongoose.Types.ObjectId(clinic._id)},{isOpen: false}, {});
        }
      }
      return true;
    } catch (err) {
      console.log("\n error in checkInProviderNotAtDesk:", err.message || err);
    }
  });
};
const sendStatusToPatients = function () {
  return cron.schedule("* * * * *", async () => {
    try {
      console.log("\n==== cron start====\n");
      const clinicSettings = await DBoperations.findAll(
        settingSchema,
        {},
        { clinicId: 1, statusSetting: 1, lastPatientStatusUpdate: 1 },
        {}
      );
      if (!clinicSettings || !clinicSettings.length === 0) {
        return;
      }
      for (let i = 0; i < clinicSettings.length; i++) {
        let singleClinicSetting = clinicSettings[i];
        //console.log("\n singleClinicSetting:", singleClinicSetting);
        if (
          singleClinicSetting &&
          !singleClinicSetting.lastPatientStatusUpdate
        ) {
          await DBoperations.findAndUpdate(
            settingSchema,
            { _id: singleClinicSetting._id },
            { lastPatientStatusUpdate: new Date() },
            { new: true }
          );
        } else if (
          singleClinicSetting &&
          singleClinicSetting.lastPatientStatusUpdate
        ) {
          console.log("\n when lastPatientStatusUpdate found...");
          await fetchLocationPatientAndSendStatus(singleClinicSetting);
        }
      }
    } catch (err) {
      console.log("\n error in sendStatusToPatients:", err.message || err);
    }
  });
};
//-----------------Helper---------------------//

function diff_minutes(dt2, dt1) {
  return new Promise((resolve, reject) => {
    try {
      var diff = (dt2.getTime() - dt1.getTime()) / 1000;
      diff /= 60;
      return resolve(Math.abs(Math.round(diff)));
    } catch (err) {
      return reject(err);
    }
  });
}
function sendMessageToPatient(clientInfo, patientInfo, locationinfo) {
  return new Promise(async (resolve, reject) => {
    try {
      const checkInAlertSetting = await DBoperations.findOne(
        settingSchema,
        { clinicId: clientInfo._id },
        { checkInAlert: 1 },
        {}
      );
      if (
        checkInAlertSetting &&
        checkInAlertSetting.checkInAlert &&
        !checkInAlertSetting.checkInAlert.is_active
      ) {
        return;
      }
      const patientData = await DBoperations.findOne(
        User,
        { _id: patientInfo._id, userType: 2 },
        {},
        { lean: true }
      );
      if (!patientData) {
        throw {
          status: 404,
          message: commonFunctions.getErrorMessage("patientNotFound"),
        };
      }
      const clinicLocationData = await DBoperations.findOne(
        locationSchema,
        { _id: locationinfo._id },
        { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
        { lean: true }
      );
      if (!clinicLocationData || !clinicLocationData.twilioNumber) {
        throw {
          status: 404,
          message:
            "This clinic location has not any messages number.Contact to Admin.",
        };
      }
      const { status, message, count, totalCount, businessName } =
        await commonFunctions.checkSettingAndUpdateMessage(
          "checkInAlert",
          clinicLocationData.clinicId,
          patientData,
          clinicLocationData._id
        );
      const defaultMessage = await commonFunctions.getReplyMessage("checkIn");
      const sendMessage = status ? message : defaultMessage;
      if (clinicLocationData?.allowSmsFeature) {
        const sendPayload = {
          to: patientData.fullNumber,
          from: clinicLocationData.twilioNumber,
          body: sendMessage,
        };
        await commonFunctions.sendTwilioMessage(sendPayload);
        await commonFunctions.updateMessage(
          clinicLocationData._id,
          clinicLocationData.clinicId,
          patientData._id,
          sendMessage,
          2,
          true
        );
      } else {
        await commonFunctions.updateMessage(
          clinicLocationData._id,
          clinicLocationData.clinicId,
          patientData._id,
          sendMessage,
          2,
          false
        );
      }
      return resolve(true);
    } catch (err) {
      return reject(err);
    }
  });
}
function sendPaperWorkReminder(patientInfo, locationinfo, submissionID) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!patientInfo || !patientInfo.fullNumber || !submissionID) {
        return resolve(true);
      }
      if (!locationinfo || !locationinfo.twilioNumber) {
        return resolve(true);
      }
      let firstName =
        patientInfo && patientInfo.first_name ? patientInfo.first_name : "";
      let lastName =
        patientInfo && patientInfo.last_name ? patientInfo.last_name : "";
      const full_name = `${firstName} ${lastName}`;
      const jotFormUrl = `${process.env.HIPPA_JOT_URL}/edit/${submissionID}`;
      const sendMessage = await commonFunctions.getReplyMessage(
        "not_submit_paperwork",
        0,
        0,
        "",
        full_name,
        0,
        jotFormUrl
      );
      if (locationinfo?.allowSmsFeature) {
        const sendPayload = {
          to: patientInfo.fullNumber,
          from: locationinfo.twilioNumber,
          body: sendMessage,
        };
        await Promise.all([
          commonFunctions.sendTwilioMessage(sendPayload),
          commonFunctions.updateMessage(
            locationinfo._id,
            locationinfo.clinicId,
            patientData._id,
            sendMessage,
            2,
            true
          ),
        ]);
      } else {
        await commonFunctions.updateMessage(
            locationinfo._id,
          locationinfo.clinicId,
          patientData._id,
          sendMessage,
          2,
          false
        );
      }
      return resolve(true);
    } catch (err) {
      return reject(err);
    }
  });
}
async function fetchLocationPatientAndSendStatus(singleClinicSetting) {
  return new Promise(async (resolve) => {
    try {
      if (
        singleClinicSetting &&
        singleClinicSetting.statusSetting &&
        singleClinicSetting.statusSetting.isSendStatus
      ) {
        //console.log("\n if clinic:", singleClinicSetting._id);
        let diffenceFromCurrent = await diff_minutes(
          new Date(singleClinicSetting.lastPatientStatusUpdate),
          new Date()
        );
        const compareTime = singleClinicSetting.statusSetting.sendStatusTime
          ? parseInt(singleClinicSetting.statusSetting.sendStatusTime)
          : 0;
        console.log(
          "\n diffenceFromCurrent:",
          diffenceFromCurrent,
          "\n compareTime:",
          compareTime
        );
        if (diffenceFromCurrent > compareTime) {
          await DBoperations.findAndUpdate(
            settingSchema,
            { _id: singleClinicSetting._id },
            { lastPatientStatusUpdate: new Date() },
            { new: true }
          );
          // fetch clinic All Active locations
          const clinicLocationsData = await DBoperations.findAll(
            locationSchema,
            {
              clinicId: singleClinicSetting.clinicId,
              isActive: true,
              isOpen: true,
              twilioNumber: { $exists: true, $ne: null },
            },
            {},
            { lean: true }
          );
          if (clinicLocationsData && clinicLocationsData.length > 0) {
            //console.log("\n clinic locations:", clinicLocationsData);
            // fetch location patient for the day
            const { start, end } =
              await commonFunctions.getUTCStartEndOfTheDay();
            for (let i = 0; i < clinicLocationsData.length; i++) {
              const singleLocation = clinicLocationsData[i];
              let queryPayload = {
                locationId: singleLocation._id,
                visitDate: { $gte: new Date(start), $lte: new Date(end) },
                inQueue: true,
                isCancel: false,
                isCheckIn: false,
                isCheckOut: false,
                is_block: false,
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
                DBoperations.aggregateData(ClinicPatient, aggregate),
                DBoperations.count(ClinicPatient, queryPayload),
              ]);
              if (existClinicPatient && existClinicPatient.length > 0) {
                for (let p = 0; p < existClinicPatient.length; p++) {
                  const statusMessage = await commonFunctions.getReplyMessage(
                    "status",
                    p + 1,
                    totalPatients
                  );
                  // here send message to pateint
                  if (singleLocation?.allowSmsFeature) {
                    const sendPayload = {
                      to: existClinicPatient[p].patientId.fullNumber,
                      from: singleLocation.twilioNumber,
                      body: statusMessage,
                    };
                    console.log("\n sendPayload:", sendPayload);
                    await commonFunctions.sendTwilioMessage(sendPayload);
                    await commonFunctions.updateMessage(
                      singleLocation._id,
                      singleLocation.clinicId,
                      existClinicPatient[p].patientId._id,
                      statusMessage,
                      2,
                      true
                    );
                  } else {
                    await commonFunctions.updateMessage(
                      singleLocation._id,
                      singleLocation.clinicId,
                      existClinicPatient[p].patientId._id,
                      statusMessage,
                      2,
                      false
                    );
                  }
                }
              }
            }
          }
        }
      }
      return resolve(true);
    } catch (err) {
      console.log(
        "\n error occur in fetchLocationPatientAndSendStatus scheduler:",
        err.message || err
      );
      return resolve({ status: false, error: err });
    }
  });
}

const scheduler = {
  checkAndNotifyPatient: checkAndNotifyPatient,
  updateUserAtTheEndOfDay: updateUserAtTheEndOfDay,
  updateParkingSpot: updateParkingSpot,
  updateNameChangeRequest: updateNameChangeRequest,
  checkPaperworkAndReminder: checkPaperworkAndReminder,
  checkProvidernotAtDesk: checkProvidernotAtDesk,
  sendStatusToPatients: sendStatusToPatients,
  scheduleClinicOpening: scheduleClinicOpening,
};

module.exports = scheduler;
