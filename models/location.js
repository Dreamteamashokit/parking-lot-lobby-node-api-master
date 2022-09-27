'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema;
var locationSchema = Schema({
    clinicId:{type:Schema.Types.ObjectId,ref:'user'},
    name:{type:String},
    jotformId:{type:Schema.Types.ObjectId,ref:'jotform'},
    isOpen:{type:Boolean, default:false},
    isScheduleOpen:{type:Boolean, default:false},
    isScheduleClose:{type:Boolean, default:false},
    selectedTimeZone:{type: {
        name: String,
        value: String,
        offset: Number,
    }},
    openingTime:{type: String},
    closingTime:{type: String},
    isActive:{type:Boolean, default:true},
    isDefault:{type:Boolean,default:false},
    twilioNumber: {type: String,required: false,default: null},
    allowSmsFeature: {type: Boolean,default: true}, //false=> Deactive , 1=> Active   
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});
locationSchema.index({ id: -1 });
locationSchema.index({clinicId:-1});
locationSchema.index({jotformId:-1});
module.exports = mongoose.model("location", locationSchema);