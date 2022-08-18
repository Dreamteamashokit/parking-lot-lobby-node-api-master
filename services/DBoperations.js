'use strict';

let saveData = function(model,data){
    return new model(data).save();
};

let getData = function (model, query, projection, options, populateData) {
        return model.find(query, projection, options).populate(populateData);
};
let findAll = function (model, query, projection, options) {
    return model.find(query, projection, options);
};

let findOne = function (model, query, projection, options) {
    return model.findOne(query, projection, options);
};

let findAndUpdate = function (model, conditions, update, options={new: true}) {
    return  model.findOneAndUpdate(conditions, update, options);
};

let findAndRemove = function (model, conditions, options) {
    return  model.findOneAndRemove(conditions, options);
};

let update = function (model, conditions, update, options) {
    return model.update(conditions, update, options);
};
let updateMany = function (model, conditions, update, options) {
    return model.updateMany(conditions, update, options);
};

let deleteMany = function (model, condition) {
    return model.deleteMany(condition);
};


let count = function (model, condition) {
    return model.countDocuments(condition);
};
/*
 ----------------------------------------
 AGGREGATE DATA
 ----------------------------------------
 */
 let aggregateData = function (model, aggregateArray,options) {
    let aggregation = model.aggregate(aggregateArray);

    if(options)
        aggregation.options = options;

    return aggregation.exec();
};

let insert = function(model, data, options){
    return model.collection.insert(data,options);
};

let insertMany = function(model, data, options){
    return model.collection.insertMany(data,options);
};



const DBoperations = {
    saveData : saveData,
    getData: getData,
    update : update,
    deleteMany : deleteMany,
    insert : insert,
    insertMany:insertMany,
    count  : count,
    findOne: findOne,
    updateMany:updateMany,
    findAndRemove:findAndRemove,
    findAndUpdate:findAndUpdate,
    aggregateData:aggregateData,
    findAll:findAll
}

module.exports = DBoperations;
