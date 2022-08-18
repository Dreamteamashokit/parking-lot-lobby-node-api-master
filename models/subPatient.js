'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema

var subPatientSchema = Schema({
    first_name: {type: String},
    last_name: {type: String},
    email: {type: String,lowercase: true},
    gender: {type: String,enum: ['1', '2', '3'],required: false}, // 1 => Male , 2 => Female
    dob: {type: Date,default: null},
    parentClientId:{type:Schema.Types.ObjectId,ref:'client_patient'},
    submissionID: {type: String},
},
{
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
})

subPatientSchema.index({parentClientId:-1});
var SubPatient = mongoose.model('sub_patient', subPatientSchema);
module.exports = SubPatient;