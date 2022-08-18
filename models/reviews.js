'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema;
var reviewSchema = Schema({
    patientId:{type:Schema.Types.ObjectId,ref:'user'},
    locationId:{type:Schema.Types.ObjectId,ref:'location'},
    point:{type:Number,default:0},
    comment:{type:String,default:''}
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});
reviewSchema.index({ id: -1 });
reviewSchema.index({patientId:-1});
reviewSchema.index({locationId:-1});
module.exports = mongoose.model("review", reviewSchema);