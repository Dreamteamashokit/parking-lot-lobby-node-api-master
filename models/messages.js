'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema;
var messageSchema = Schema({
    content:{type:String,default:''},
    message_status:{type: Boolean, default: false},
    initial_message:{type:Boolean,default:false},
    isReadByAdmin:{type:Boolean, default:false},
    patientId:{type:Schema.Types.ObjectId,ref:'user'},
    clinicId:{type:Schema.Types.ObjectId,ref:'user'},
    locationId:{type:Schema.Types.ObjectId,ref:'location'},
    type:{type:Number,enum :[1,2], default:2}, // 1=> user message 2=> system message
    twilioSend:{type: Boolean,default: false} // true=> is msg send using twilio 2=> if msg not send using twilio
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});
messageSchema.index({ id: -1 });
messageSchema.index({patientId:-1});
module.exports = mongoose.model("message", messageSchema);