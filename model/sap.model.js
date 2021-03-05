const moment = require("moment");
var mongoose = require("mongoose");
const { FGEX } = require("../model/fgex.model");
const { changeOverMaster } = require('./changeovermaster.model');
const { Batchskutrigger } = require('./batch.model');

var sapschema = new mongoose.Schema(
  {
    PONumber: {///
      type: String,
      required: true,
    },
    LOTNumber: {
      type: String,
      required: true,
    },
    LOTSize: {
      type: Number,
      required: true,
    },
    // EXPDATE: {
    //   type: Date,
    //   required: true,
    // },
    // MFGDATE: {
    //   type: Date,
    //   required: true,
    // },
    PlantCode: {
      type: String,
      required: true,
    },
    ProductCode: {
      type: String,
      required: true,
    },
    HalbCode: {
      type: String,
    },
    ProductDescription: {
      type: String,
      required: true,
    },
    // LineName: {
    //   type: String,
    //  // required: true,
    // },
    // LineCode:{
    //   type: String,
    // //  required: true,
    // },
    isUsed: {
      type: Boolean,
      default: false
    },
    current_status: {
      type: String,
      default: "unassign"
    },
    postApiHitFrom: {
      type: String,
      default: "Intas Sap"
    },
    PlantName:{
      type: String,
      required:true,
    },
    UpdateTimestamp: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);
var Sap = mongoose.model("sap", sapschema);


///update sap assigen 
var updateSapStatus = async ( id)=>{
 
  var result = await Sap.updateOne(
    {
      _id:id
    },
    {
      $set: {
        current_status:"assign"
      },
    }
  );
  return result;
}



module.exports.Sap = Sap;
module.exports.updateSapStatus = updateSapStatus;
