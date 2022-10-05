'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema;
var clinicPatientSchema = Schema({
    clinicId:{type:Schema.Types.ObjectId,ref:'user'},
    patientId:{type:Schema.Types.ObjectId,ref:'user'},
    locationId:{type:Schema.Types.ObjectId,ref:'location'},
    inQueue:{type:Boolean, default:false},
    isCancel:{type:Boolean,default:false},
    isCheckIn:{type:Boolean, default:false},
    isCheckOut:{type:Boolean, default:false},
    is_block: {type: Boolean,default: false},
    is_delay:{type:Boolean,default:false},
    is_delete:{type:Boolean,default:false},
    noShow:{type:Boolean,default:false},
    visitDate:{type:Date},
    checkIn:{type:Date},
    inQueueAt:{type:Date},
    checkOut:{type:Date},
    parkingSpot:{type:String},
    notifyTime:{type:Date},
    notifyAt:{type:Date},
    isNotify:{type:Boolean,default:false},
    clientSmsNotify:{type:Boolean,default:false},
    visitReason:{type:String, default:null},
    visitType:{type:Array, default:[]},
    coronavirusContact:{type: String,enum: ['1', '2', '3'],required: false}, // 1=> yes 2 =>No  3 => nor sure
    submissionID: {type: String},
    submitPaperWork:{type:Boolean,default:false},
    paperworkNotify:{type:Boolean,default:false},
    paperWorkSubmissionId:{type: String},
    uploadNotify: {type:Boolean,default:false},
    waitingForReview:{type:Boolean,default:false},
    clinicOffNotify:{type:Boolean,default:false},
    reviewDocument: {type:Boolean, default:false}
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});
clinicPatientSchema.index({ id: -1 });
clinicPatientSchema.index({patientId:-1});
clinicPatientSchema.index({locationId:-1});
clinicPatientSchema.index({clinicId:-1});
module.exports = mongoose.model("client_patient", clinicPatientSchema);