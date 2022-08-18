'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema;
var quickResponsesSchema = Schema({
    clinicId:{type:Schema.Types.ObjectId,ref:'user'},
    message:{type:String, require:true},
    type:{type:Number, enum:[1,2], default:2},
    is_deleted:{type:Boolean, default: false}
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});
quickResponsesSchema.index({ id: -1 });
quickResponsesSchema.index({clinicId:-1});
module.exports = mongoose.model("quick_responses", quickResponsesSchema);