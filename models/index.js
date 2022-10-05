import User from './user';
import Message from './messages';
import clinicPatient from './clinicPatient';
import quickResponses from './quickResponses';
import settingSchema from './settings';
import location from './location';
import review from './reviews';
import jotformSchema from './jotform';
import subPatientSchema from './subPatient';
import loggerSchema from './logger';
module.exports = {
    User:User,
    Message:Message,
    ClinicPatient:clinicPatient,
    QuickResponses:quickResponses,
    settingSchema:settingSchema,
    locationSchema:location,
    reviewSchema:review,
    jotformSchema,
    loggerSchema,
    SubPatientSchema: subPatientSchema
}