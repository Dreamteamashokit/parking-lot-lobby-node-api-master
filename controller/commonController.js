import {
  User,
  Message,
  settingSchema,
  QuickResponses,
  ClinicPatient,
  locationSchema,
  SubPatientSchema,
} from "../models";
import { DbOperations, commonFunctions } from "../services";
var mongoose = require("mongoose");
import axios from "axios";

class CommonController {
  static async addQuickResponse(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.message) {
          throw {
            status: 400,
            message: "Missing Required Parameters:message.",
          };
        }
        const insertPayload = {
          clinicId: userData.id,
          message: payloadData.message,
        };
        const updatedData = await DbOperations.saveData(
          QuickResponses,
          insertPayload
        );
        return resolve(updatedData);
      } catch (err) {
        console.log("\n error in addQuickResponse:", err.message || err);
        return reject(err);
      }
    });
  }
  static async getQuickResponse(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        let queryPayload = {
          clinicId: userData.id,
          is_deleted: false,
        };
        const quickResponses = await DbOperations.getData(
          QuickResponses,
          queryPayload,
          {},
          { lean: true, sort: { createdAt: -1 } },
          []
        );
        return resolve(quickResponses);
      } catch (err) {
        console.log("\n error in getQuickResponse:", err.message || err);
        return reject(err);
      }
    });
  }
  static async updateQuickResponse(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.responseId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:responseId.",
          };
        }
        if (!payloadData.message) {
          throw {
            status: 400,
            message: "Missing Required Parameters:message.",
          };
        }
        let findPayload = { _id: payloadData.responseId, is_deleted: false };
        const quickResponses = await DbOperations.findOne(
          QuickResponses,
          findPayload,
          {},
          { lean: true }
        );
        if (!quickResponses) {
          throw {
            status: 400,
            message:
              "No Response found into Our system for provided response Id.",
          };
        }
        const queryPayload = {
          _id: payloadData.responseId,
          clinicId: userData.id,
        };
        const updatePayload = { message: payloadData.message };
        const response = await DbOperations.findAndUpdate(
          QuickResponses,
          queryPayload,
          updatePayload,
          { new: true }
        );
        return resolve(response);
      } catch (err) {
        console.log("\n error in updateQuickResponse:", err.message || err);
        return reject(err);
      }
    });
  }
  static async removeQuickResponse(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.id) {
          throw { status: 400, message: "Missing Required Parameters:id." };
        }
        let findPayload = { _id: payloadData.id, is_deleted: false };
        const quickResponses = await DbOperations.findOne(
          QuickResponses,
          findPayload,
          {},
          { lean: true }
        );
        if (!quickResponses) {
          throw {
            status: 400,
            message:
              "No Response found into Our system for provided response Id.",
          };
        }
        const response = await DbOperations.findAndRemove(QuickResponses, {
          _id: payloadData.id,
        });
        return resolve(response);
      } catch (err) {
        console.log("\n removeQuickResponse error:", err.message || err);
        return reject(err);
      }
    });
  }
  static async fetchList(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        const type = [1, 2, 3];
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.type) {
          throw { status: 400, message: "Missing required Parameter: type" };
        }
        const requestType = parseInt(payloadData.type);
        if (!type.includes(requestType)) {
          throw {
            status: 400,
            message: "Invalid Type. Please use 1,2 or 3 for type.",
          };
        }
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        let queryPayload = {};
        switch (requestType) {
          case 1:
            queryPayload = {
              locationId: mongoose.Types.ObjectId(userData.locationId),
              visitDate: { $gte: new Date(start), $lte: new Date(end) },
              inQueue: true,
              isCancel: false,
              isCheckIn: false,
              isCheckOut: false,
              is_block: false,
            };
            break;
          case 2:
            queryPayload = {
              locationId: mongoose.Types.ObjectId(userData.locationId),
              visitDate: { $gte: new Date(start), $lte: new Date(end) },
              inQueue: false,
              isCancel: false,
              isCheckIn: true,
              isCheckOut: false,
              is_block: false,
            };
            break;
          case 3:
            queryPayload = {
              locationId: mongoose.Types.ObjectId(userData.locationId),
              visitDate: { $gte: new Date(start), $lte: new Date(end) },
              inQueue: false,
              isCancel: false,
              isCheckIn: false,
              isCheckOut: true,
              is_block: false,
            };
            break;
          default:
            break;
        }
        let aggregate = [
          { $match: queryPayload },
          {
            $lookup: {
              from: "users",
              localField: "clinicId",
              foreignField: "_id",
              as: "clinicData",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "patientId",
              foreignField: "_id",
              as: "patientData",
            },
          },
          {
            $lookup: {
              from: "sub_patients",
              localField: "_id",
              foreignField: "parentClientId",
              as: "subPatientData",
            },
          },
          { $unwind: { path: "$clinicData" } },
          { $unwind: { path: "$patientData" } },
          {
            $lookup: {
              from: "messages",
              let: {
                patientId: "$patientId",
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$patientId", "$$patientId"] },
                        { $eq: ["$isReadByAdmin", false] },
                      ],
                    },
                  },
                },
              ],
              as: "chat_messages",
            },
          },
        ];
        if (payloadData.searchBy) {
          aggregate.push({
            $match: {
              $or: [
                {
                  "patientData.first_name": new RegExp(
                    payloadData.searchBy,
                    "i"
                  ),
                },
                {
                  "patientData.last_name": new RegExp(
                    payloadData.searchBy,
                    "i"
                  ),
                },
              ],
            },
          });
        }

        aggregate.push(
          {
            $project: {
              _id: 1,
              inQueue: 1,
              isCancel: 1,
              isCheckIn: 1,
              isCheckOut: 1,
              is_block: 1,
              is_delay: 1,
              inQueueAt: 1,
              checkIn: 1,
              checkOut: 1,
              noShow: 1,
              uploadNotify: 1,
              clinicId: {
                _id: "$clinicData._id",
                fullNumber: "$clinicData.fullNumber",
                email: "$clinicData.email",
                userType: "$clinicData.userType",
              },
              patientId: {
                _id: "$patientData._id",
                fullNumber: "$patientData.fullNumber",
                userType: "$patientData.userType",
                email: "$patientData.email",
                first_name: "$patientData.first_name",
                last_name: "$patientData.last_name",
                visitNotes: "$patientData.visitNotes",
                carOrLobby: "$patientData.carOrLobby",
              },
              visitDate: 1,
              createdAt: 1,
              updatedAt: 1,
              parkingSpot: 1,
              notifyTime: 1,
              isNotify: 1,
              visitReason: 1,
              submissionID: 1,
              reviewDocument: 1,
              notifyAt: 1,
              chat_messages: { $size: "$chat_messages" },
              subPatientData: "$subPatientData",
            },
          },
          { $sort: { inQueueAt: 1 } }
        );
        const existClinicPatient = await DbOperations.aggregateData(
          ClinicPatient,
          aggregate
        );
        //const existClinicPatient = await DbOperations.getData(ClinicPatient,queryPayload, {}, {lean: true}, populateQuery);
        return resolve(existClinicPatient);
      } catch (err) {
        console.log("\n error in fetchList:", err.message || err);
        return reject(err);
      }
    });
  }
  static async fetchPatientChat(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing required Parameter: patientId",
          };
        }
        let queryPayload = {
          patientId: payloadData.patientId,
          locationId: userData.locationId,
          clinicId: userData.id,
        };
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        const clinicQuery = {
          locationId: userData.locationId,
          clinicId: userData.id,
          patientId: payloadData.patientId,
          visitDate: { $gte: new Date(start), $lte: new Date(end) },
          inQueue: true,
          uploadNotify: true,
        };
        const isUploadedMedia = await DbOperations.findOne(
          ClinicPatient,
          clinicQuery,
          {},
          { lean: true }
        );
        if (isUploadedMedia) {
          await DbOperations.findAndUpdate(ClinicPatient, clinicQuery, {
            uploadNotify: false,
          });
          io.sockets
            .to(`room_${userData.id}`)
            .emit("new-patient", {
              clientId: userData.id,
              locationId: userData.locationId,
            });
        }
        const messages = await DbOperations.getData(
          Message,
          queryPayload,
          {},
          { lean: true },
          []
        );
        return resolve(messages);
      } catch (err) {
        console.log("\n error in fetchPatientChat:", err.message || err);
        return reject(err);
      }
    });
  }
  static async waitingToCheckIn(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        const queryPayload = {
          patientId: payloadData.patientId,
          clinicId: userData.id,
          locationId: userData.locationId,
          visitDate: { $gte: new Date(start), $lte: new Date(end) },
        };
        const updatePayload = {
          inQueue: false,
          isCheckIn: true,
          checkIn: new Date(),
        };
        const response = await DbOperations.findAndUpdate(
          ClinicPatient,
          queryPayload,
          updatePayload,
          { new: true }
        );
        //#We have removed code from here and save it into feedbackChanges.js
        const patientData = await DbOperations.findOne(
          User,
          { _id: payloadData.patientId, userType: 2 },
          {},
          { lean: true }
        );
        if (!patientData) {
          throw {
            status: 404,
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
        const { status, message, count, totalCount, businessName } =
          await commonFunctions.checkSettingAndUpdateMessage(
            "checkInAlert",
            userData.id,
            patientData,
            userData.locationId
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
            userData.locationId,
            userData.id,
            patientData._id,
            sendMessage,
            2,
            true
          );
        } else {
          await commonFunctions.updateMessage(
            userData.locationId,
            userData.id,
            patientData._id,
            sendMessage,
            2,
            false
          );
        }
        io.sockets
          .to(`room_${userData.id}`)
          .emit("move-patient", {
            clientId: userData.id,
            type: 1,
            locationId: userData.locationId,
          });
        return resolve(response);
      } catch (err) {
        console.log("\n error in waitingToCheckIn:", err.message || err);
        return reject(err);
      }
    });
  }
  static async checkInToCheckOut(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        const queryPayload = {
          patientId: payloadData.patientId,
          clinicId: userData.id,
          locationId: userData.locationId,
          visitDate: { $gte: new Date(start), $lte: new Date(end) },
          isCheckIn: true,
        };
        const updatePayload = {
          inQueue: false,
          isCheckIn: false,
          isCheckOut: true,
          checkOut: new Date(),
        };
        //#We have removed code from here and save it into feedbackChanges.js
        const checkOutAlertSetting = await DbOperations.findOne(
          settingSchema,
          { clinicId: userData.id },
          { checkOutAlert: 1 },
          {}
        );
        if (
          checkOutAlertSetting &&
          checkOutAlertSetting.checkOutAlert &&
          checkOutAlertSetting.checkOutAlert.is_active
        ) {
          const patientData = await DbOperations.findOne(
            User,
            { _id: payloadData.patientId, userType: 2 },
            {},
            { lean: true }
          );
          if (!patientData) {
            throw {
              status: 404,
              message: commonFunctions.getErrorMessage("patientNotFound"),
            };
          }
          const [clinicLocationData] = await Promise.all([
            DbOperations.findOne(
              locationSchema,
              { _id: userData.locationId },
              { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
              { lean: true }
            ),
          ]);
          if (!clinicLocationData || !clinicLocationData.twilioNumber) {
            throw new Error(
              "This clinic location has not any messages number.Contact to Admin."
            );
          }

          let firstName =
            patientData && patientData.first_name ? patientData.first_name : "";
          let lastName =
            patientData && patientData.last_name ? patientData.last_name : "";
          const full_name = `${firstName} ${lastName}`;
          const { status, message, count, totalCount, businessName } =
            await commonFunctions.checkSettingAndUpdateMessage(
              "checkOutAlert",
              userData.id,
              patientData,
              userData.locationId
            );
          const defaultMessage = await commonFunctions.getReplyMessage(
            "checkOut",
            count,
            totalCount,
            businessName,
            full_name,
            0,
            ""
          );
          const sendMessage = status ? message : defaultMessage;
          if (clinicLocationData?.allowSmsFeature) {
            const sendPayload = {
              to: patientData.fullNumber,
              from: clinicLocationData.twilioNumber,
              body: sendMessage,
            };
            await Promise.all([
              commonFunctions.sendTwilioMessage(sendPayload),
              commonFunctions.updateMessage(
                userData.locationId,
                userData.id,
                patientData._id,
                sendMessage,
                2,
                true
              ),
            ]);
          } else {
            await commonFunctions.updateMessage(
              userData.locationId,
              userData.id,
              patientData._id,
              sendMessage,
              2,
              false
            );
          }

          updatePayload["waitingForReview"] = true;
          const response = await DbOperations.findAndUpdate(
            ClinicPatient,
            queryPayload,
            updatePayload,
            { new: true }
          );
          io.sockets
            .to(`room_${userData.id}`)
            .emit("move-patient", {
              clientId: userData.id,
              type: 2,
              locationId: userData.locationId,
            });
          return resolve(response);
        } else {
          const response = await DbOperations.findAndUpdate(
            ClinicPatient,
            queryPayload,
            updatePayload,
            { new: true }
          );
          io.sockets
            .to(`room_${userData.id}`)
            .emit("move-patient", {
              clientId: userData.id,
              type: 2,
              locationId: userData.locationId,
            });
          return resolve(response);
        }
      } catch (err) {
        console.log("\n error in checkInToCheckOut:", err.message || err);
        return reject(err);
      }
    });
  }
  static async notifyPatient(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        if (!payloadData.notifyTime) {
          throw {
            status: 400,
            message: "Missing Required Parameters:notifyTime.",
          };
        }
        if (isNaN(payloadData.notifyTime)) {
          throw {
            status: 400,
            message: "Please use numerical value for notifyTime.",
          };
        }
        if (
          parseInt(payloadData.notifyTime) === -1 ||
          parseInt(payloadData.notifyTime) < 0
        ) {
          payloadData.notifyTime = 0;
        }

        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        const queryPayload = {
          patientId: payloadData.patientId,
          clinicId: userData.id,
          locationId: userData.locationId,
          visitDate: { $gte: new Date(start), $lte: new Date(end) },
        };
        const { updatedDate } = await commonFunctions.addMinutes(
          parseInt(payloadData.notifyTime)
        );
        const updatePayload = {
          notifyTime: new Date(updatedDate),
          notifyAt: new Date(updatedDate),
          isNotify: true,
          clientSmsNotify: false,
        };
        const response = await DbOperations.findAndUpdate(
          ClinicPatient,
          queryPayload,
          updatePayload,
          { new: true }
        );
        if (parseInt(payloadData.notifyTime) === 0) {
          const checkInAlertSetting = await DbOperations.findOne(
            settingSchema,
            { clinicId: userData.id },
            { checkInAlert: 1 },
            {}
          );
          if (
            checkInAlertSetting &&
            checkInAlertSetting.checkInAlert &&
            checkInAlertSetting.checkInAlert.is_active
          ) {
            const patientData = await DbOperations.findOne(
              User,
              { _id: payloadData.patientId, userType: 2 },
              {},
              { lean: true }
            );
            if (!patientData) {
              throw {
                status: 404,
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
            const { status, message, count, totalCount, businessName } =
              await commonFunctions.checkSettingAndUpdateMessage(
                "checkInAlert",
                userData.id,
                patientData,
                userData.locationId
              );
            const defaultMessage = await commonFunctions.getReplyMessage(
              "checkIn"
            );
            const sendMessage = status ? message : defaultMessage;
            if (clinicLocationData?.allowSmsFeature) {
              const sendPayload = {
                to: patientData.fullNumber,
                from: clinicLocationData.twilioNumber,
                body: sendMessage,
              };
              await Promise.all([
                commonFunctions.sendTwilioMessage(sendPayload),
                commonFunctions.updateMessage(
                  clinicLocationData._id,
                  clinicLocationData.clinicId,
                  patientData._id,
                  sendMessage,
                  2,
                  true
                ),
              ]);
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

            await DbOperations.findAndUpdate(
              ClinicPatient,
              queryPayload,
              { clientSmsNotify: true },
              { new: true }
            );
          }
        }
        //#We have removed code from here and save it into feedbackChanges.js//
        return resolve(response);
      } catch (err) {
        console.log("\n error in notifyPatient:", err.message || err);
        return reject(err);
      }
    });
  }
  static async removePatient(payloadData, bodyPayload, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.id) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        if (!bodyPayload.deleteType) {
          throw {
            status: 400,
            message: "Missing Required Parameters into body:deleteType.",
          };
        }
        if (bodyPayload.deleteType === 1) {
          const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
          await Promise.all([
            DbOperations.findAndUpdate(
              User,
              { _id: payloadData.id },
              { isChangeNameRequest: false, isParkingSpotRequest: false }
            ),
            DbOperations.findAndRemove(ClinicPatient, {
              patientId: payloadData.id,
              locationId: userData.locationId,
              clinicId: userData.id,
              visitDate: { $gte: new Date(start), $lte: new Date(end) },
            }),
          ]);
        } else if (bodyPayload.deleteType === 2) {
          await Promise.all([
            DbOperations.deleteMany(Message, {
              patientId: payloadData.id,
              locationId: userData.locationId,
            }),
            DbOperations.findAndRemove(User, { _id: payloadData.id }),
            DbOperations.deleteMany(ClinicPatient, {
              patientId: payloadData.id,
              locationId: userData.locationId,
              clinicId: userData.id,
            }),
          ]);
        } else if (bodyPayload.deleteType === 3) {
          await DbOperations.findAndRemove(ClinicPatient, {
            _id: payloadData.id,
            locationId: userData.locationId,
            clinicId: userData.id,
          });
        }
        io.sockets
          .to(`room_${userData.id}`)
          .emit("remove-patient", {
            clientId: userData.id,
            locationId: userData.locationId,
          });
        return resolve(true);
      } catch (err) {
        console.log("\n error in removePatient:", err.message || err);
        return reject(err);
      }
    });
  }
  static async updateNoShow(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        let noShowUpdate = payloadData.noShow ? payloadData.noShow : false;
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        const response = await DbOperations.findAndUpdate(
          ClinicPatient,
          {
            patientId: payloadData.patientId,
            locationId: userData.locationId,
            visitDate: { $gte: new Date(start), $lte: new Date(end) },
          },
          { noShow: noShowUpdate },
          { new: true }
        );
        const noShowAlertSetting = await DbOperations.findOne(
          settingSchema,
          { clinicId: userData.id },
          { noShowAlert: 1 },
          {}
        );
        if (
          noShowUpdate &&
          noShowAlertSetting &&
          noShowAlertSetting.noShowAlert &&
          noShowAlertSetting.noShowAlert.is_active
        ) {
          const clinicLocationData = await DbOperations.findOne(
            locationSchema,
            { _id: userData.locationId },
            { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
            { lean: true }
          );
          if (!clinicLocationData || !clinicLocationData.twilioNumber) {
            throw new Error(
              "This clinic location has not any messaging number.Contact to Admin."
            );
          }
          const patientData = await DbOperations.findOne(
            User,
            { _id: payloadData.patientId, userType: 2 },
            {},
            { lean: true }
          );
          if (!patientData) {
            throw new Error(commonFunctions.getErrorMessage("patientNotFound"));
          }

          const { status, message } =
            await commonFunctions.checkSettingAndUpdateMessage(
              "noShowAlert",
              userData.id,
              patientData,
              userData.locationId
            );
          const defaultMessage = await commonFunctions.getReplyMessage(
            "noShowAlert"
          );
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
        }
        return resolve(response);
      } catch (err) {
        console.log("\n error in updateNoShow:", err.message || err);
        return reject(err);
      }
    });
  }
  static async updateDelayForPatient(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        let isDelayUpdate = payloadData.is_delay ? payloadData.is_delay : false;
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        const response = await DbOperations.findAndUpdate(
          ClinicPatient,
          {
            patientId: payloadData.patientId,
            locationId: userData.locationId,
            visitDate: { $gte: new Date(start), $lte: new Date(end) },
          },
          { is_delay: isDelayUpdate },
          { new: true }
        );
        return resolve(response);
      } catch (err) {
        console.log("\n error in updateDelayForPatient:", err.message || err);
        return reject(err);
      }
    });
  }
  static async updateNotes(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        if (!payloadData.visitNotes) {
          throw {
            status: 400,
            message: "Missing Required Parameters:visitNotes.",
          };
        }
        const { start, end } = await commonFunctions.getUTCStartEndOfTheDay();
        const clinicQuery = {
          locationId: userData.locationId,
          clinicId: userData.id,
          patientId: payloadData.patientId,
          visitDate: { $gte: new Date(start), $lte: new Date(end) },
        };
        const response = await DbOperations.findAndUpdate(
          ClinicPatient,
          clinicQuery,
          { visitReason: payloadData.visitNotes },
          { new: true }
        );
        io.sockets
          .to(`room_${userData.id}`)
          .emit("new-patient", {
            clientId: userData.id,
            locationId: userData.locationId,
          });

        // jotform pr save krna ....
        return resolve(response);
      } catch (err) {
        console.log("\n error in updateNotes:", err.message || err);
        return reject(err);
      }
    });
  }
  static async addClient(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.first_name) {
          throw {
            status: 400,
            message: "Missing Required Parameters:first_name",
          };
        }
        if (!payloadData.last_name) {
          throw {
            status: 400,
            message: "Missing Required Parameters:last_name",
          };
        }
        if (!payloadData.fullNumber) {
          throw {
            status: 400,
            message: "Missing Required Parameters:fullNumber",
          };
        }
        if (!payloadData.dob) {
          throw { status: 400, message: "Missing Required Parameters:dob" };
        }
        if (!payloadData.hasOwnProperty("waitingOrCheckIn")) {
          throw {
            status: 400,
            message: "Missing Required Parameters:waitingOrCheckIn",
          };
        }
        const checkExistPatient = await DbOperations.findOne(
          User,
          { fullNumber: payloadData.fullNumber },
          {},
          { lean: true }
        );
        if (checkExistPatient) {
          throw new Error("Patient with provided phone already Exit.");
        }
        const clinicLocationData = await DbOperations.findOne(
          locationSchema,
          { _id: userData.locationId },
          { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
          { lean: true }
        );
        if (!clinicLocationData || !clinicLocationData.twilioNumber) {
          throw new Error(
            "This clinic location has not any messaging number.Contact to Admin."
          );
        }
        if (payloadData.parkingSpot) {
          let message_body = payloadData.parkingSpot || "";
          if (isNaN(message_body)) {
            if (message_body.toLowerCase() !== "put") {
              throw new Error("You have provied a wrong parking spot");
            }
          }
        }
        const userPayload = {
          userType: 2,
          email: payloadData.fullNumber,
          first_name: payloadData.first_name,
          last_name: payloadData.last_name,
          fullNumber: payloadData.fullNumber,
          dob: new Date(payloadData.dob),
          visitNotes: payloadData.visitNotes ? payloadData.visitNotes : null,
          carOrLobby: payloadData.waitingOrCheckIn ? 1 : 2,
        };
        let response = await DbOperations.saveData(User, userPayload);
        const payloadClinicPatient = {
          clinicId: userData.id,
          locationId: userData.locationId,
          patientId: response._id,
          inQueueAt: new Date(),
          inQueue: true,
        };
        if (payloadData.parkingSpot) {
          payloadClinicPatient["parkingSpot"] = payloadData.parkingSpot;
        }
        await DbOperations.saveData(ClinicPatient, payloadClinicPatient);
        io.sockets
          .to(`room_${userData.id}`)
          .emit("new-patient", {
            clientId: userData.id,
            from_web: true,
            locationId: userData.locationId,
          });

        let clinicFormId = await commonFunctions.fetchJotformId(
          userData.locationId
        ); // '212500804377046';
        await jotFormSubmit(
          payloadData,
          clinicFormId,
          payloadData.fullNumber,
          userData.locationId
        );
        let userName = `${payloadData.first_name} ${payloadData.last_name}`;
        const settingMessageType = "confirmationAlert";
        const { status, message, count, totalCount, businessName } =
          await commonFunctions.checkSettingAndUpdateMessage(
            settingMessageType,
            userData.id,
            response,
            userData.locationId
          );
        const inforClientPositionLineSetting = await DbOperations.findOne(
          settingSchema,
          { clinicId: userData.id },
          { inforClientPositionLine: 1 },
          {}
        );
        if (
          inforClientPositionLineSetting &&
          inforClientPositionLineSetting.inforClientPositionLine
        ) {
          const messageFetchType = "waiting_existing";
          const defaultMessage = await commonFunctions.getReplyMessage(
            messageFetchType,
            count,
            totalCount,
            businessName,
            userName
          );
          const sendMessage = status ? message : defaultMessage;
          if (clinicLocationData?.allowSmsFeature) {
            const sendPayload = {
              to: payloadData.fullNumber,
              from: clinicLocationData.twilioNumber,
              body: sendMessage,
            };
            await commonFunctions.sendTwilioMessage(sendPayload);
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              response._id,
              sendMessage,
              2,
              true
            );
          } else {
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              response._id,
              sendMessage,
              2,
              false
            );
          }
        } else {
          const messageFetchType = "waiting_existing_withoutLinePosition";
          const defaultMessage = await commonFunctions.getReplyMessage(
            messageFetchType,
            count,
            totalCount,
            businessName,
            userName
          );
          const sendMessage = status ? message : defaultMessage;
          if (clinicLocationData?.allowSmsFeature) {
            const sendPayload = {
              to: payloadData.fullNumber,
              from: clinicLocationData.twilioNumber,
              body: sendMessage,
            };
            await commonFunctions.sendTwilioMessage(sendPayload);
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              response._id,
              sendMessage,
              2,
              true
            );
          } else {
            await commonFunctions.updateMessage(
              clinicLocationData._id,
              clinicLocationData.clinicId,
              response._id,
              sendMessage,
              2,
              false
            );
          }
        }
        return resolve(response);
      } catch (err) {
        console.log("\n error in addClient:", err.message || err);
        return reject(err);
      }
    });
  }
  static async addlocation(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.name) {
          throw {
            status: 400,
            message: "Missing Required Parameters:first_name",
          };
        }
        const clinicData = await DbOperations.findOne(
          User,
          { _id: userData.id, userType: 1 },
          {},
          { lean: true }
        );
        if (!clinicData) {
          throw new Error(commonFunctions.getErrorMessage("clinicNotFound"));
        }
        if (!clinicData.allowLocationAdd) {
          throw {
            status: 401,
            message:
              "Add location feature disabled for your account. Please contact admin.",
          };
        }
        payloadData["clinicId"] = userData.id;
        let response = await DbOperations.saveData(locationSchema, payloadData);
        return resolve(response);
      } catch (err) {
        console.log("\n error in addlocation:", err.message || err);
        return reject(err);
      }
    });
  }
  static async fetchlocations(userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        const clinicData = await DbOperations.findOne(
          User,
          { _id: userData.id, userType: 1 },
          {},
          { lean: true }
        );
        if (!clinicData) {
          throw new Error(commonFunctions.getErrorMessage("clinicNotFound"));
        }
        let response = await DbOperations.findAll(locationSchema, {
          clinicId: userData.id,
          isActive: true,
        });
        return resolve(response);
      } catch (err) {
        console.log("\n error in addlocation:", err.message || err);
        return reject(err);
      }
    });
  }
  static async updatePatientInfo(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData._id) {
          throw {
            status: 400,
            message: "Missing Required Parameters:Record Id.",
          };
        }
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        const userPayload = { ...payloadData.patientId };
        delete userPayload._id;

        const patientPayload = { ...payloadData };
        delete patientPayload._id;
        delete patientPayload.patientId;

        const [response, patientInfo, clinicLocationData] = await Promise.all([
          DbOperations.findAndUpdate(
            ClinicPatient,
            {
              _id: payloadData._id,
              clinicId: userData.id,
              locationId: userData.locationId,
            },
            patientPayload,
            { new: true }
          ),
          DbOperations.findAndUpdate(
            User,
            { _id: payloadData.patientId._id },
            userPayload,
            { new: true }
          ),
          DbOperations.findOne(
            locationSchema,
            { _id: userData.locationId },
            { twilioNumber: 1, clinicId: 1 },
            { lean: true }
          ),
        ]);

        if (!clinicLocationData || !clinicLocationData.twilioNumber) {
          throw new Error(
            "This clinic location has not any messages number.Contact to Admin."
          );
        }

        const submissionID = response.submissionID
          ? response.submissionID
          : null;
        if (!submissionID) {
          return resolve(response);
        }
        let clinicFormId = await commonFunctions.fetchJotformId(
          clinicLocationData._id
        ); // '212500804377046';
        const jotPayload = {
          first_name: patientInfo.first_name,
          last_name: patientInfo.last_name,
          email: patientInfo.email,
          parkingSpot: response.parkingSpot,
        };
        await jotFormUpdate(
          jotPayload,
          clinicFormId,
          patientInfo.fullNumber,
          submissionID
        );
        // need to update jotform...
        io.sockets
          .to(`room_${userData.id}`)
          .emit("update-patientInfomation", {
            clientId: userData.id,
            locationId: clinicLocationData._id,
          });
        return resolve(response);
      } catch (err) {
        console.log("\n error in updateNotes:", err.message || err);
        return reject(err);
      }
    });
  }
  static async backToWaiting(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.recordId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:recordId.",
          };
        }
        const queryPayload = {
          _id: payloadData.recordId,
          locationId: userData.locationId,
          clinicId: userData.id,
        };
        const updatePayload = {
          inQueue: true,
          isCheckIn: false,
          isCheckOut: false,
        };
        const response = await DbOperations.findAndUpdate(
          ClinicPatient,
          queryPayload,
          updatePayload,
          { new: true }
        );
        io.sockets
          .to(`room_${userData.id}`)
          .emit("new-patient", {
            clientId: userData.id,
            from_web: true,
            locationId: userData.locationId,
          });
        return resolve(response);
      } catch (err) {
        console.log("\n error in backToWaiting:", err.message || err);
        return reject(err);
      }
    });
  }
  static async updateCarLobby(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.patientId) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        if (!payloadData.carLobby) {
          throw {
            status: 400,
            message: "Missing Required Parameters:carLobby.",
          };
        }
        const patientInfo = await DbOperations.findAndUpdate(
          User,
          { _id: payloadData.patientId },
          { carOrLobby: payloadData.carLobby },
          { new: true }
        );
        io.sockets
          .to(`room_${userData.id}`)
          .emit("new-patient", {
            clientId: userData.id,
            locationId: userData.locationId,
          });
        return resolve(patientInfo);
      } catch (err) {
        console.log("\n error in updateNotes:", err.message || err);
        return reject(err);
      }
    });
  }
  static async fetchFormUploads(payloadData, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payloadData.submissionID) {
          throw {
            status: 400,
            message: "Missing Required Parameters:submissionID.",
          };
        }
        const clientPatient = await DbOperations.findOne(
          ClinicPatient,
          { submissionID: payloadData.submissionID },
          {},
          { lean: true }
        );
        let subPatientUploads = [];
        if (clientPatient && clientPatient._id) {
          const subPatientsData = await DbOperations.findAll(
            SubPatientSchema,
            { parentClientId: clientPatient._id },
            {},
            { lean: true }
          );
          for (let s = 0; s < subPatientsData.length; s++) {
            if (subPatientsData[s].submissionID) {
              const subResponse = await commonFunctions.getSubmission(
                subPatientsData[s].submissionID
              );
              //console.log('\n subResponse:', subResponse)
              if (subResponse && subResponse.length > 0) {
                subPatientUploads = [...subPatientUploads, ...subResponse];
                //subPatientUploads.push({id: subPatientsData._id, uploads: subResponse})
              }
            }
          }
        }
        let response = await commonFunctions.getSubmission(
          payloadData.submissionID
        );
        response = [...response, ...subPatientUploads];
        return resolve(response);
      } catch (err) {
        console.log("\n error in fetchFormUploads:", err.message || err);
        return reject(err);
      }
    });
  }
  static async generatePdf(payloadData) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!payloadData.submissionID) {
          throw {
            status: 400,
            message: "Missing Required Parameters:submissionID.",
          };
        }
        if (!payloadData.type) {
          throw { status: 400, message: "Missing Required Parameters:type." };
        }
        const response = await commonFunctions.getFormData(
          payloadData.submissionID
        );
        //response.form_id
        switch (parseInt(payloadData.type)) {
          case 1:
            const response_form1 = await submissionForm1(
              response,
              payloadData.submissionID
            );
            return resolve(response_form1);
          default:
            throw { message: "Invalid type Please contact to site Admin." };
        }
        /* case 2:
                    const response_form2 =  await submissionForm2(response,payloadData.submissionID);
                    return resolve(response_form2) 
                */
      } catch (err) {
        console.log("\n error in generatePdf:", err.message || err);
        return reject(err);
      }
    });
  }
  static async checkInProviderNotAtDesk() {
    return new Promise(async (resolve, reject) => {
      try {
        const clinicLocationsData = await DbOperations.findAll(
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
          const patientFortheDay = await DbOperations.findAll(ClinicPatient, {
            locationId: { $in: locationIds },
            inQueue: true,
            clinicOffNotify: false,
            visitDate: { $gte: new Date(start), $lte: new Date(end) },
          });
          if (patientFortheDay && patientFortheDay.length > 0) {
            for (let j = 0; j < patientFortheDay.length; j++) {
              //console.log("\n\n=== patientFortheDay", patientFortheDay)
              const patientData = await DbOperations.findOne(
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
                  const intialMessage = await DbOperations.findOne(
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
                    if (diffenceFromCurrent > companySettings.certainTime) {
                      const clinicLocationData = await DbOperations.findOne(
                        locationSchema,
                        { _id: patientFortheDay[j].locationId },
                        { twilioNumber: 1, clinicId: 1, allowSmsFeature: 1 },
                        { lean: true }
                      );
                      if (
                        clinicLocationData &&
                        clinicLocationData.twilioNumber
                      ) {
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
                        await DbOperations.findAndUpdate(
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
          return resolve({
            clinicLocationsData: clinicLocationsData,
            patientFortheDay: patientFortheDay,
          });
        }
        return resolve({ clinicLocationsData: clinicLocationsData });
      } catch (err) {
        console.log(
          "\n error in checkInProviderNotAtDesk:",
          err.message || err
        );
        return reject(err);
      }
    });
  }
  static async getAttachmentFromUrl(payloadData) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!payloadData.url) {
          throw { status: 400, message: "Missing Required Parameters:url." };
        }
        let arrayBuffer = await axios.get(payloadData.url, {
          responseType: "arraybuffer",
        });
        let buffer = Buffer.from(arrayBuffer.data, "binary").toString("base64");
        let returnedB64 = `data:${arrayBuffer.headers["content-type"]};base64,${buffer}`;
        return resolve(returnedB64);
      } catch (err) {
        console.log("\n error in generatePdf:", err.message || err);
        return reject(err);
      }
    });
  }
  static async reviewDocument(payload, userData) {
    return new Promise(async (resolve, reject) => {
      try {
        await commonFunctions.checkUserInformation(userData);
        if (!payload || !payload.id) {
          throw {
            status: 400,
            message: "Missing Required Parameters:patientId.",
          };
        }
        const response = await DbOperations.findAndUpdate(
          ClinicPatient,
          {
            _id: payload.id,
            clinicId: userData.id,
            locationId: userData.locationId,
          },
          { reviewDocument: true },
          { new: true }
        );
        return resolve(response);
      } catch (err) {
        console.log("\n error in updateNotes:", err.message || err);
        return reject(err);
      }
    });
  }
}

module.exports = CommonController;

//================Helper=======================//
async function jotFormSubmit(
  payloadData,
  FormId,
  fullNumber,
  locationId,
  submissionId = null
) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("\n submissionId:", submissionId);
      const [questions, year, month, day] = await Promise.all([
        commonFunctions.getFormQuestions(FormId),
        commonFunctions.formatDate(payloadData.dob, "YYYY"),
        commonFunctions.formatDate(payloadData.dob, "MM"),
        commonFunctions.formatDate(payloadData.dob, "DD"),
      ]);
      if (questions) {
        const fieldData = {};
        for (let [key, value] of Object.entries(questions)) {
          if (value && value.hasOwnProperty("name")) {
            let fieldName = value.name;
            let qid = value.hasOwnProperty("qid") ? value.qid : 0;
            switch (fieldName) {
              case "whatParking":
                fieldData[`submission[${qid}]`] = payloadData.parkingSpot
                  ? payloadData.parkingSpot
                  : "";
                break;
              case "hasPatient":
                fieldData[`submission[${qid}]`] =
                  payloadData.hasPatient && payloadData.hasPatient === 1
                    ? "YES"
                    : "NO";
                break;
              case "patientName":
                fieldData[`submission[${qid}_first]`] = payloadData.first_name;
                fieldData[`submission[${qid}_last]`] = payloadData.last_name;
                break;
              case "dateOfBirth":
                fieldData[`submission[${qid}_year]`] = year;
                fieldData[`submission[${qid}_month]`] = month;
                fieldData[`submission[${qid}_day]`] = day;
                break;
              case "reasonFor":
                fieldData[`submission[${qid}]`] = payloadData.visitNotes;
                break;
              case "email":
                fieldData[`submission[${qid}]`] = payloadData.fullNumber
                  ? payloadData.fullNumber
                  : "";
                break;
              case "phoneNumber":
                fieldData[`submission[${qid}]`] = fullNumber;
                break;
              case "location_id":
                fieldData[`submission[${qid}]`] = locationId;
              default:
                break;
            }
          }
        }
        console.log("\n fieldData:", fieldData);
        const isFieldDataEmpty = await commonFunctions.IsEmpty(fieldData);
        if (!isFieldDataEmpty) {
          console.log("\n create.....");
          const submissionResponse = await commonFunctions.createFormSubmission(
            FormId,
            fieldData
          );
          if (
            submissionResponse &&
            submissionResponse.hasOwnProperty("submissionID")
          ) {
            return resolve(submissionResponse.submissionID);
          } else {
            return resolve("");
          }
        } else {
          return reject({
            message:
              "contact to Admin jot form is empty without required field",
          });
        }
      }
      return reject({
        message: "contact to Admin, No question found for clinic jot form.",
      });
    } catch (err) {
      return reject(err);
    }
  });
}
async function jotFormUpdate(
  payloadData,
  FormId,
  fullNumber,
  submissionId = null
) {
  return new Promise(async (resolve, reject) => {
    try {
      const [questions] = await Promise.all([
        commonFunctions.getFormQuestions(FormId),
      ]);
      if (questions) {
        const fieldData = {};
        for (let [key, value] of Object.entries(questions)) {
          if (value && value.hasOwnProperty("name")) {
            let fieldName = value.name;
            let qid = value.hasOwnProperty("qid") ? value.qid : 0;
            switch (fieldName) {
              case "whatParking":
                fieldData[`submission[${qid}]`] = payloadData.parkingSpot
                  ? payloadData.parkingSpot
                  : "";
                break;
              case "patientName":
                fieldData[`submission[${qid}_first]`] = payloadData.first_name;
                fieldData[`submission[${qid}_last]`] = payloadData.last_name;
                break;
              case "email":
                fieldData[`submission[${qid}]`] = payloadData.email
                  ? payloadData.email
                  : "";
                break;
              default:
                break;
            }
          }
        }
        console.log("\n update fieldData:", fieldData);
        const isFieldDataEmpty = await commonFunctions.IsEmpty(fieldData);
        if (!isFieldDataEmpty) {
          const submissionUpdateResponse =
            await commonFunctions.editFormSubmission(submissionId, fieldData);
          return resolve(submissionUpdateResponse);
        } else {
          return reject({
            message:
              "contact to Admin jot form is empty without required field",
          });
        }
      }
      return reject({
        message: "contact to Admin, No question found for clinic jot form.",
      });
    } catch (err) {
      return reject(err);
    }
  });
}
async function submissionForm1(response, submissionID) {
  return new Promise(async (resolve, reject) => {
    try {
      const payloadObject = {};
      if (response && response.hasOwnProperty("answers")) {
        for (let [key, value] of Object.entries(response.answers)) {
          if (value && value.hasOwnProperty("name")) {
            let fieldName = value.name;
            switch (fieldName) {
              case "patientName":
                const answer1 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["patientName"] = {
                  text: value.text,
                  answer: answer1,
                  isMultimedia: false,
                };
                break;

              case "updatedAddress1":
                const answer2 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["updatedAddress1"] = {
                  text: value.text,
                  answer: answer2,
                  isMultimedia: false,
                };
                break;

              case "insuranceUpdate1":
                const answer3 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["insuranceUpdate1"] = {
                  text: value.text,
                  answer: answer3,
                  isMultimedia: false,
                };
                break;

              case "reasonFor":
                const answer4 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["reasonFor"] = {
                  text: value.text,
                  answer: answer4,
                  isMultimedia: false,
                };
                break;
              case "hasPatient":
                const answer5 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["hasPatient"] = {
                  text: value.text,
                  answer: answer5,
                  isMultimedia: false,
                };
                break;

              case "doesPatient":
                const answer6 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["doesPatient"] = {
                  text: value.text,
                  answer: answer6,
                  isMultimedia: false,
                };
                break;

              case "whatParking":
                const answer7 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["whatParking"] = {
                  text: value.text,
                  answer: answer7,
                  isMultimedia: false,
                };
                break;

              case "insuranceFront":
                const answer8 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["insuranceFront"] = {
                  text: value.text,
                  answer: answer8,
                  isMultimedia: true,
                };
                break;
              case "drivingLicenseFront":
                const answer9 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["drivingLicenseFront"] = {
                  text: value.text,
                  answer: answer9,
                  isMultimedia: true,
                };
                break;

              case "drivingLicenseBack":
                const answer10 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["drivingLicenseBack"] = {
                  text: value.text,
                  answer: answer10,
                  isMultimedia: true,
                };
                break;

              case "primaryInsurance":
                const answer11 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["primaryInsurance"] = {
                  text: value.text,
                  answer: answer11,
                  isMultimedia: false,
                };
                break;

              case "PatientSecondaryInsurance":
                const answer12 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["PatientSecondaryInsurance"] = {
                  text: value.text,
                  answer: answer12,
                  isMultimedia: false,
                };
                break;

              case "patientSecondaryInsuranceAdd":
                const answer13 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["patientSecondaryInsuranceAdd"] = {
                  text: value.text,
                  answer: answer13,
                  isMultimedia: false,
                };
                break;

              case "secondaryInsuranceFront":
                const answer14 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["secondaryInsuranceFront"] = {
                  text: value.text,
                  answer: answer14,
                  isMultimedia: true,
                };
                break;

              case "checkInAnotherPatient":
                const answer15 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["checkInAnotherPatient"] = {
                  text: value.text,
                  answer: answer15,
                  isMultimedia: false,
                };
                break;

              case "doesPatient1Insurance":
                const answer16 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["doesPatient1Insurance"] = {
                  text: value.text,
                  answer: answer16,
                  isMultimedia: false,
                };
                break;

              case "email":
                const answer17 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["email"] = {
                  text: value.text,
                  answer: answer17,
                  isMultimedia: false,
                };
                break;

              case "dateOfBirth":
                const answer18 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["dateOfBirth"] = {
                  text: value.text,
                  answer: answer18,
                  isMultimedia: false,
                };
                break;

              case "location_id":
                const answer19 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["location_id"] = {
                  text: value.text,
                  answer: answer19,
                  isMultimedia: false,
                };
                break;

              case "phoneNumber":
                const answer20 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["phoneNumber"] = {
                  text: value.text,
                  answer: answer20,
                  isMultimedia: false,
                };
                break;

              case "maritalStatus":
                const answer21 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["maritalStatus"] = {
                  text: value.text,
                  answer: answer21,
                  isMultimedia: false,
                };
                break;

              case "hipaaNotice":
                const answer22 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["hipaaNotice"] = {
                  text: value.text,
                  answer: answer22,
                  isMultimedia: false,
                };
                break;

              case "gender":
                const answer23 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["gender"] = {
                  text: value.text,
                  answer: answer23,
                  isMultimedia: false,
                };
                break;

              case "socialSecurity":
                const answer24 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["socialSecurity"] = {
                  text: value.text,
                  answer: answer24,
                  isMultimedia: false,
                };
                break;

              case "preferredLanguage":
                const answer25 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["preferredLanguage"] = {
                  text: value.text,
                  answer: answer25,
                  isMultimedia: false,
                };
                break;

              case "ethnicity":
                const answer26 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["ethnicity"] = {
                  text: value.text,
                  answer: answer26,
                  isMultimedia: false,
                };
                break;

              case "whoIsYourPhysician":
                const answer27 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["whoIsYourPhysician"] = {
                  text: value.text,
                  answer: answer27,
                  isMultimedia: false,
                };
                break;

              case "yourEmployer":
                const answer28 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["yourEmployer"] = {
                  text: value.text,
                  answer: answer28,
                  isMultimedia: false,
                };
                break;

              case "emergencyContact":
                const answer29 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["emergencyContact"] = {
                  text: value.text,
                  answer: answer29,
                  isMultimedia: false,
                };
                break;

              case "phoneNumbers":
                const answer30 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["phoneNumbers"] = {
                  text: value.text,
                  answer: answer30,
                  isMultimedia: false,
                };
                break;

              case "iAuthorizeToReleaseInfo":
                const answer31 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["iAuthorizeToReleaseInfo"] = {
                  text: value.text,
                  answer: answer31,
                  isMultimedia: false,
                };
                break;

              case "initials":
                const answer32 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["initials"] = {
                  text: value.text,
                  answer: answer32,
                  isMultimedia: true,
                };
                break;

              case "signature":
                const answer33 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["signature"] = {
                  text: value.text,
                  answer: answer33,
                  isMultimedia: true,
                };
                break;

              case "date":
                const answer34 = value.hasOwnProperty("prettyFormat")
                  ? value.prettyFormat
                  : null;
                payloadObject["date"] = {
                  text: value.text,
                  answer: answer34,
                  isMultimedia: false,
                };
                break;

              case "wouldYouLikeToReleaseYourInfo":
                const answer35 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["wouldYouLikeToReleaseYourInfo"] = {
                  text: value.text,
                  answer: answer35,
                  isMultimedia: false,
                };
                break;

              case "doYouHavePrimaryPhysician":
                const answer36 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["doYouHavePrimaryPhysician"] = {
                  text: value.text,
                  answer: answer36,
                  isMultimedia: false,
                };
                break;
              case "howDidYouHearAboutUs":
                const answer37 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["howDidYouHearAboutUs"] = {
                  text: value.text,
                  answer: answer37,
                  isMultimedia: false,
                };
                break;

              case "secondaryInsuranceBack":
                const answer38 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["secondaryInsuranceBack"] = {
                  text: value.text,
                  answer: answer38,
                  isMultimedia: true,
                };
                break;

              case "updatedAddress":
                const answer39 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["updatedAddress"] = {
                  text: value.text,
                  answer: answer39,
                  isMultimedia: false,
                };
                break;

              case "paymentPolicy":
                const answer40 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["paymentPolicy"] = {
                  text: value.text,
                  answer: answer40,
                  isMultimedia: false,
                };
                break;

              case "treatmentToMySelf":
                const answer41 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["treatmentToMySelf"] = {
                  text: value.text,
                  answer: answer41,
                  isMultimedia: false,
                };
                break;

              case "doesPatientUpdateInsurance":
                const answer42 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["doesPatientUpdateInsurance"] = {
                  text: value.text,
                  answer: answer42,
                  isMultimedia: false,
                };
                break;
              case "viewReceiveCommunicationFromOnlinePortal":
                const answer43 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["viewReceiveCommunicationFromOnlinePortal"] = {
                  text: value.text,
                  answer: answer43,
                  isMultimedia: false,
                };
                break;

              case "isLastVisitPhoneUpdate":
                const answer44 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["isLastVisitPhoneUpdate"] = {
                  text: value.text,
                  answer: answer44,
                  isMultimedia: false,
                };
                break;

              case "howManyMoreCheckIn":
                const answer45 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["howManyMoreCheckIn"] = {
                  text: value.text,
                  answer: answer45,
                  isMultimedia: false,
                };
                break;

              case "faxToPrimaryCarePhysician":
                const answer46 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["faxToPrimaryCarePhysician"] = {
                  text: value.text,
                  answer: answer46,
                  isMultimedia: false,
                };
                break;
              case "insuranceBack":
                const answer47 = value.hasOwnProperty("answer")
                  ? value.answer
                  : null;
                payloadObject["insuranceBack"] = {
                  text: value.text,
                  answer: answer47,
                  isMultimedia: true,
                };
                break;

              default:
                break;
            }
          }
        }
      }
      if (payloadObject.length === 0) {
        throw {
          message:
            "Sorry we can to able to find submission detail from jotfrom.",
        };
      }
      const fields = [
        "location_id",
        "whatParking",
        "patientName",
        "dateOfBirth",
        "reasonFor",
        "email",
        "gender",
        "maritalStatus",
        "preferredLanguage",
        "isLastVisitPhoneUpdate",
        "phoneNumber",
        "emergencyContact",
        "updatedAddress",
        "howDidYouHearAboutUs",
        "hasPatient",
        "doesPatient",
        "phoneNumbers",
        "insuranceFront",
        "insuranceBack",
        "updatedAddress1",
        "drivingLicenseFront",
        "drivingLicenseBack",
        "doesPatient1Insurance",
        "doesPatientUpdateInsurance",
        "primaryInsurance",
        "insuranceUpdate1",
        "patientSecondaryInsuranceAdd",
        "secondaryInsuranceFront",
        "secondaryInsuranceBack",
        "PatientSecondaryInsurance",
        "socialSecurity",
        "hipaaNotice",
        "wouldYouLikeToReleaseYourInfo",
        "iAuthorizeToReleaseInfo",
        "doYouHavePrimaryPhysician",
        "whoIsYourPhysician",
        "faxToPrimaryCarePhysician",
        "ethnicity",
        "yourEmployer",
        "viewReceiveCommunicationFromOnlinePortal",
        "initials",
        "signature",
        "date",
        "paymentPolicy",
        "checkInAnotherPatient",
        "howManyMoreCheckIn",
      ]; // treatmentToMySelf,
      let html = `<html><head><h1>Patient Detail</h1><style>
                        .img {margin-left: auto;margin-right: auto;width: 30%;height: 50%;}
                        .row {float:left;width: 100%;border-bottom: 1px solid #eee; margin: 5px 0px;}
                        .col-4 {float:left;height: auto;margin-left: 10px;width:30%;font-size: 14px;font-weight: bold;}
                        .col-8 {float:left;margin-left: 11px;width:65%;font-size: 12px;text-align: center;}
                        .col-8 td {font-size: 10px;font-weight: bold;padding: 2px 15px;}
                        </style></head><body>`;
      for (let i = 0; i < fields.length; i++) {
        let fieldName = fields[i];

        let fontColor = "color: #212529;";
        switch (fieldName) {
          case "isLastVisitPhoneUpdate":
            fontColor = "color: red;";
            break;
          case "hasPatient":
            fontColor = "color: red;";
            break;
          case "doesPatientUpdateInsurance":
            fontColor = "color: red;";
            break;
          case "doesPatient":
            fontColor = "color: red;";
            break;
          default:
            break;
        }
        if (payloadObject.hasOwnProperty(fieldName)) {
          if (payloadObject[fieldName].answer) {
            if (payloadObject[fieldName].isMultimedia) {
              html += `<div class="row">
                                <span class="col-4" style="${fontColor}">${payloadObject[fieldName].text}</span>
                                <span class="col-8"><img class="img" src="${payloadObject[fieldName].answer}" alt="image" /></span>
                                </div>`;
            } else {
              html += `<div class="row">
                                <span class="col-4" style="${fontColor}">${payloadObject[fieldName].text}</span>
                                <span class="col-8">${payloadObject[fieldName].answer}</span>
                                </div>`;
            }
          } else {
            html += `<div class="row">
                                <span class="col-4" style="${fontColor}">${payloadObject[fieldName].text}</span>
                                <span class="col-8"></span>
                                </div>`;
          }
        }
      }

      html += `</body></html>`;
      const saveResponse = await commonFunctions.saveToPdfFile(
        html,
        submissionID
      );
      return resolve(saveResponse);
    } catch (err) {
      return reject(err);
    }
  });
}
/* 
async function submissionForm2(response, submissionID) {
    return new Promise (async(resolve,reject)=>{
        try {
            const payloadObject = {};
                if (response && response.hasOwnProperty('answers')) {
                    for (let [key, value] of Object.entries(response.answers)) {
                        if (value && value.hasOwnProperty('name')) {
                            let fieldName = value.name;
                            switch (fieldName) {
                                case 'insuranceCardUpdate':
                                    const answer1 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['insuranceCardUpdate'] = {text: value.text, answer:answer1,isMultimedia:true};
                                    break;
                                case 'patientName':
                                    const answer2 = (value.hasOwnProperty('prettyFormat')) ? value.prettyFormat : null ;
                                    payloadObject['patientName']={text: value.text, answer:answer2,isMultimedia:false};
                                    break;
                                case 'updatedAddress2':
                                    const answer3 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['updatedAddress2']={text: value.text, answer:answer3,isMultimedia:false};
                                    break;
                                    
                                case 'maritalStatus':
                                    const answer4 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['maritalStatus']={text: value.text, answer:answer4,isMultimedia:false};
                                    break;
                                case 'hipaaNotice':
                                    const answer5 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['hipaaNotice']={text: value.text, answer:answer5,isMultimedia:false};
                                    break;
                                case 'typeA':
                                    const answer6 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['typeA']={text: value.text, answer:answer6,isMultimedia:false};
                                    break;
                                case 'typeA2':
                                    const answer7 =  (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['typeA2']={text: value.text, answer:answer7,isMultimedia:false};
                                    break;
                                case 'email':
                                    const answer8 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['email']={text: value.text, answer:answer8,isMultimedia:false};
                                    break;
                                case 'gender':
                                    const answer9 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['gender']={text: value.text, answer:answer9,isMultimedia:false};
                                    break;
                                case 'socialSecurity':
                                    const answer10 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['socialSecurity']={text: value.text, answer:answer10,isMultimedia:false};
                                    break;
                                case 'preferredLanguage':
                                    const answer11 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['preferredLanguage']={text: value.text, answer:answer11,isMultimedia:false};
                                    break;
                                case 'ethnicity':
                                    const answer12 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['ethnicity']={text: value.text, answer:answer12,isMultimedia:false};
                                    break;
                                case 'whoIsYourPhysician':
                                    const answer13 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['whoIsYourPhysician']={text: value.text, answer:answer13,isMultimedia:false};
                                    break;
                                case 'viewreceiveResultscommunications':
                                    const answer14 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['viewreceiveResultscommunications']={text: value.text, answer:answer14,isMultimedia:false};
                                    break;
                                case 'yourEmployer':
                                        const answer15 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                        payloadObject['yourEmployer']={text: value.text, answer:answer15,isMultimedia:false};
                                        break;
                                case 'howDidYouHearAboutUs':
                                    const answer16 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['howDidYouHearAboutUs']={text: value.text, answer:answer16,isMultimedia:false};
                                    break; 
                                case 'emergencyContact':
                                    const answer17 = (value.hasOwnProperty('prettyFormat')) ? value.prettyFormat : null ;
                                    payloadObject['emergencyContact']={text: value.text, answer:answer17,isMultimedia:false};
                                    break; 
                                case 'phoneNumbers':
                                    const answer18 = (value.hasOwnProperty('prettyFormat')) ? value.prettyFormat : null ;
                                    payloadObject['phoneNumbers']={text: value.text, answer:answer18,isMultimedia:false};
                                    break;
                                case 'secretQuestion':
                                    const answer19 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['secretQuestion']={text: value.text, answer:answer19,isMultimedia:false};
                                    break;
                                    
                                case 'iAuthorizeToReleaseInfo':
                                    const answer20 = (value.hasOwnProperty('prettyFormat')) ? value.prettyFormat : null ;
                                    payloadObject['iAuthorizeToReleaseInfo']={text: value.text, answer:answer20,isMultimedia:false};
                                    break;
                                case 'initials':
                                    const answer21 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['initials']={text: value.text, answer:answer21,isMultimedia:true};
                                    break;

                                case 'signature':
                                const answer22 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                payloadObject['signature']={text: value.text, answer:answer22,isMultimedia:true};
                                break;

                                case 'date':
                                const answer23 = (value.hasOwnProperty('prettyFormat')) ? value.prettyFormat : null ;
                                payloadObject['date']={text: value.text, answer:answer23,isMultimedia:false};
                                break;
                                case 'wouldYouLikeToReleaseYourInfo':
                                const answer24 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                payloadObject['wouldYouLikeToReleaseYourInfo']={text: value.text, answer:answer24,isMultimedia:false};
                                break;

                                case 'doYouHavePrimaryPhysician':
                                const answer25 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                payloadObject['doYouHavePrimaryPhysician']={text: value.text, answer:answer25,isMultimedia:false};
                                break;

                                case 'form1_Submission':
                                    const answer26 = (value.hasOwnProperty('answer')) ? value.answer : null ;
                                    payloadObject['form1_Submission']={text: value.text, answer:answer26,isMultimedia:false};
                                    break;
                                case 'dateOfBirth':
                                    const answer27 = (value.hasOwnProperty('prettyFormat')) ? value.prettyFormat : null ;
                                    payloadObject['dateOfBirth']={text: value.text, answer:answer27,isMultimedia:false};
                                    break;
                                default:
                                    break;
                            }
                        }
                    }
                }
                if(payloadObject.length === 0) {
                    throw ({message:'Sorry we can to able to find submission detail from jotfrom.'});
                }
                const fields = ['patientName','dateOfBirth','socialSecurity','updatedAddress2','phoneNumbers','email','gender','maritalStatus','preferredLanguage','ethnicity','doYouHavePrimaryPhysician','whoIsYourPhysician','yourEmployer','howDidYouHearAboutUs','emergencyContact','wouldYouLikeToReleaseYourInfo','iAuthorizeToReleaseInfo','hipaaNotice','initials','signature','date','form1_Submission'];
                let html = `<html><head><h1>Form name</h1><style>
                        .img {margin-left: auto;margin-right: auto;width: 30%;height: 50%;}
                        .row {float:left;width: 100%;border-bottom: 1px solid #eee; margin: 5px 0px;}
                        .col-4 {float:left;height: auto;margin-left: 10px;width:30%;font-size: 14px;font-weight: bold;}
                        .col-8 {float:left;margin-left: 11px;width:65%;font-size: 12px;text-align: center;}
                        .col-8 td {font-size: 10px;font-weight: bold;padding: 2px 15px;}
                        </style></head><body>`;
                for(let i=0; i < fields.length;i++) {
                    let fieldName = fields[i];
                    if(payloadObject.hasOwnProperty(fieldName)) {
                        if(payloadObject[fieldName].answer) {
                            if(payloadObject[fieldName].isMultimedia) {
                                html +=`<div class="row">
                                <span class="col-4">${payloadObject[fieldName].text}</span>
                                <span class="col-8"><img class="img" src="${payloadObject[fieldName].answer}" alt="image" /></span>
                                </div>`;
                            } else {
                                html +=`<div class="row">
                                <span class="col-4">${payloadObject[fieldName].text}</span>
                                <span class="col-8">${payloadObject[fieldName].answer}</span>
                                </div>`;
                            }
                        } else {
                            html +=`<div class="row">
                                <span class="col-4">${payloadObject[fieldName].text}</span>
                                <span class="col-8"></span>
                                </div>`;
                        }
                        
                    }
                }
               
                html +=`</body></html>`;
                const saveResponse = await commonFunctions.saveToPdfFile(html, submissionID)
              return resolve(saveResponse);
        } catch (err) {
            return reject(err);
        }
    })
} */
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
