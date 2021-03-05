var mongoose = require("mongoose")
var operatorSchema = new mongoose.Schema({
    operator_name:{
        type:String,
        required:true
    },
    display_name:{
        type:String,
    },
    code:{
        type:Number,
    },
},{timestamps:true})

var Operator = mongoose.model("operator",operatorSchema);
module.exports.Operator = Operator;