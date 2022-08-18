'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema;
var locationSchema = Schema({
    clinicId:{type:Schema.Types.ObjectId,ref:'user'},
    name:{type:String},
    isOpen:{type:Boolean, default:false},
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
module.exports = mongoose.model("location", locationSchema);