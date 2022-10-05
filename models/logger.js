'use strict';
var mongoose = require('mongoose');
const Schema = mongoose.Schema;
var loggerSchema = Schema({
    status: { type: String, default: '' },
    content: { type: String, default: '' },
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    }
});

module.exports = mongoose.model("logger", loggerSchema);