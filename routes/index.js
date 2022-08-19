import userRouter from './user';
import twilioRouter from './twilio';
import commonRouter from './common';
import adminRouter from './admin';
import jotformRouter from './jotform';
module.exports = {
  userRouter:userRouter,
  twilioRouter:twilioRouter,
  commonRouter:commonRouter,
  adminRouter:adminRouter,
  jotformRouter,
}