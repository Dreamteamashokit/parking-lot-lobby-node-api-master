import jotformRouter from './jotform';
import userRouter from './user';
import twilioRouter from './twilio';
import commonRouter from './common';
import adminRouter from './admin';
import scheduleAppointmentRouter from './scheduleappointment';
module.exports = {
  jotformRouter,
  userRouter:userRouter,
  twilioRouter:twilioRouter,
  commonRouter:commonRouter,
  adminRouter:adminRouter,
  scheduleAppointmentRouter:scheduleAppointmentRouter
}