'use strict';
var mongoose = require('mongoose');
const Schema  = mongoose.Schema;
var jotformSchema = Schema({
    name:{type:String},
    jotformId:{type:String, required: true},
    isActive:{type:Boolean, default:true},
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});
jotformSchema.index({ id: -1 });
module.exports = mongoose.model("jotform", jotformSchema);