'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema
var userSchema = Schema({
    first_name: {type: String},
    last_name: {type: String},
    email: {type: String,lowercase: true,unique: false},
    password: {type: String},
    gender: {type: String,enum: ['1', '2', '3'],required: false}, // 1 => Male , 2 => Female
    dob: {type: Date,default: null},
    image: {type: String,required: false,default: null},
    address: {type: String,required: false,default: null},
    fullNumber: {type: String,required: false,default: null},
    status: {type: Boolean,default: true}, //false=> Deactive , 1=> Active
    is_deleted: {type: Boolean,default: false}, 
    agreeTermCondition: {type:Boolean, default:false},
    userType:{type:Number, default:2, enum:[1,2,3]}, // 1=> provider, 2=> patient , 3=> Admin
    FromCountry: {type: String},
    isChangeNameRequest:{type:Boolean, default:false},
    isParkingSpotRequest:{type:Boolean, default:false},
    atRequestForParkingSpot:{type:Date},
    onNameChangeRequest:{type:Date},
    forgotToken: {type: String},
    visitNotes:{type:String, default:null},
    membership: {
        plan: Number,
        amount: Number,
        validity: Date,
        isAutoPayEnable: {type: Boolean,default: false}
    },
    stripe: {type: String},
    isTextNotification :{type:Number, default:2, enum:[1,2]},  //1=> yes 2 => NO
    hasPatient:{type:Number, default:2, enum:[1,2]}, // 1=> YES, 2=> NO
    clinicId:{type:Schema.Types.ObjectId,ref:'user'},
    locationId:{type:Schema.Types.ObjectId,ref:'location'},
    carOrLobby:{type:Number, default:2, enum:[1,2]}, // 1=> YES, 2=> NO
    allowLocationAdd: {type: Boolean,default: true}, //false=> Deactive , 1=> Active
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});
userSchema.index({ id: -1 });
userSchema.index({fullNumber:-1});
var User = mongoose.model('user', userSchema);
module.exports = User;