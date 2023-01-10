import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
dotenv.config();
import {userRouter, twilioRouter, commonRouter, adminRouter, jotformRouter} from './routes/index.js'
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';
import {scheduler} from './services';
import {addAdmin, tracer} from './services/commonFunctions';

import mongoose from 'mongoose';

import cors from 'cors';

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
    // process.exit(1);
  });

// Add admin user if not exist
addAdmin().then((res)=> {
  console.log("\n====admin user add successfully==\n",res )
}).catch((error)=> {
  console.log("\n====admin add error====\n",error.message || error )
})

if(!process.env.TWILIO_ACCOUNT_SID ||
  !process.env.TWILIO_AUTH_TOKEN) {
    throw 'Missing Twilio Required parameters in .env';
}
if(!process.env.BUSINESS_NAME) {
  throw 'Please Provide your Business name into .env file';
}
if(!process.env.SERVER) {
  throw 'Please let us know that you are on live or local server into .env file:eg: SERVER=local';
}
if(!process.env.BASEURL) {
   throw 'Please add BASEURL into .env file';
}
if(!process.env.WEBSITE_URL) {
  throw new Error('Missing enviornment variable: WEBSITE_URL');
}
var app = express();
// var accessLogStream = rfs.createStream('access.log', {
//   interval: '1d', // rotate daily
//   path: path.join(__dirname, 'logs')
// })
// app.use(morgan('combined', { stream: accessLogStream }))
app.use(cors());
const url = (process.env.SERVER=== 'local') ? `${process.env.HOST}:${process.env.PORT}` : process.env.BASEURL;
swaggerDocument.servers = [
  {
      "url": `https://${url}/`,
      "description": "Secure server"
  },
  {
    "url": `http://${url}/`,
    "description": "un-secure server"
  },
]
var options = {
  explorer: true
};

mongoose.connect(process.env.DB_URL,{useUnifiedTopology: true,useNewUrlParser:true,useCreateIndex:true, useFindAndModify: false});
mongoose.connection.on('error',function(err){
  process.exit();
});
mongoose.connection.on('open',()=>{
  console.log('database connected successfully');
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// app.use(logger('dev'));
app.use(express.json({limit: '100mb'}));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: function(res, path) {
    if (path.indexOf("mms") !== -1) {
      res.attachment(path)
    }
  }
}));

app.all('*', function(req, res, next) {
  try {
    tracer(req);
  } catch (error) {
    console.log('tracer1', error)
  }
  next();
});

app.use('/twilio', twilioRouter);
app.use('/user', userRouter);
app.use('/common', commonRouter);
app.use('/admin', adminRouter);
app.use('/jotform', jotformRouter);
app.use('/documentation',swaggerUi.serve, swaggerUi.setup(swaggerDocument, options));
// catch 404 and forward to error handler
app.use('*', (req, res) => {
  return res.status(404).json({
    success: false,
    message: 'API endpoint doesnt exist'
  })
});
/* app.use(function(req, res, next) {
  next(createError(404));
}); */

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
// cront for check notifyTime and update to patient...
scheduler.checkAndNotifyPatient();
scheduler.updateUserAtTheEndOfDay();
scheduler.updateParkingSpot();
scheduler.updateNameChangeRequest();
scheduler.checkPaperworkAndReminder();
scheduler.checkProvidernotAtDesk();
scheduler.sendStatusToPatients();
scheduler.scheduleClinicOpening();
scheduler.syncFormSubmissions();
scheduler.makeAutoPaymentMembership();
module.exports = app;
