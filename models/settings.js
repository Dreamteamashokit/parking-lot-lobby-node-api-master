'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema;
var settingSchema = Schema({
    clinicId:{type:Schema.Types.ObjectId,ref:'user'},
    businessInformation: {
        companyName:{type:String},
        companyAddress:{type:String},
        companyNumber:{type:String},
        timeZone:{
            label:{type:String, default:'UTC'},
            value:{type:String, default:'Etc/UTC'}
        },
        language:{
            label:{type:String, default:'english'},
            value:{type:String, default:'english'},
            name:{type:String, default:'english'}
        },
        locationNumber:{type:Number, default:1},
        logo:{type:String, default:''}
    },
    confirmationAlert:{
        is_active:{type:Boolean, default:true},
        message:{type:String, require:true},
        new_message:{type:String, require:true}
    },
    nextInLineAlert:{
        is_active:{type:Boolean, default:true},
        message:{type:String, require:true}
    },
    checkInAlert:{
        is_active:{type:Boolean, default:true},
        message:{type:String, require:true}
    },
    checkOutAlert:{
        is_active:{type:Boolean, default:true},
        message:{type:String, require:true}
    },
    noShowAlert:{
        is_active:{type:Boolean, default:true},
        message:{type:String, require:true}
    },
    parkingSpotAlert:{
        is_active:{type:Boolean, default:true},
        message:{type:String, require:true}
    },
    companyOffAlert:{
        is_active:{type:Boolean, default:true},
        message:{type:String, require:true}
    },
    desktopAdditional:{
        is_active:{type:Boolean, default:true},
        is_timer:{type:Boolean, default:true},
        is_exit:{type:Boolean, default:true},
        is_checkIn:{type:Boolean, default:true},
        is_delayed:{type:Boolean, default:true},
    },
    inforClientPositionLine:{type:Boolean, default:true},
    clientIncomplete:{type:Boolean, default:false},
    stylingScreen:{type:Boolean, default:false},
    clientInformation:{
        name:{type:Boolean, default:true},
        is_required:{type:Boolean, default:true},
        firstLastName:{type:Boolean, default:true}
    },
    signageInformation: {
        companyName:{type:String},
        companyAddress:{type:String},
        generatedPhoneNumber:{type:String},
        signNumber:{type:Number},
        locationNumber:{type:Number, default:1},
        logo:{type:String, default:''}
    },
    reviewLinkAlert:{
        is_active:{type:Boolean, default:true},
        message:{type:String, require:true}
    },
    providerNotAtDeskAlert:{
        is_active:{type:Boolean, default:false},
        message:{type:String, require:true},
        certainTime: {type:Number, require:true, default:15}
    },
    statusSetting:{
        isSendStatus:{type:Boolean, default:false},
        sendStatusTime: {type:Number, default:0}
    },
    lastPatientStatusUpdate: {type:Date}
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});
settingSchema.index({ id: -1 });
settingSchema.index({clinicId:-1});
module.exports = mongoose.model("settings", settingSchema);