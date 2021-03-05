var mongoose = require("mongoose");
var moment = require("moment");
var Fgex = mongoose.Schema(
  {
    fgex: {
      type: String
    },
    product_name: {
      type: String,
    },
    pack: {
      type: Number,
    },
    halb_code: {
      type: String,
    },
    // type: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "type",
    // },
    type:String,
    blister_size: {
      type: String,
    },
    blister_min: Number,
    blister_max: Number,
    current_machine: String,
    blister_per_format: Number,
    machine_cycle: Number,
    rated_speed: Number,
    tablet_per_blister:{
      type:Number,
      default:0,
    },
    layout_no: String,
    weight_per_format:Number,
    Remark:String,
    Secondary_machines_speed:Number,
    T200_use:{
      type:Boolean,
    },
    No_of_blisters:Number,
  },
  { timestamps: true }
);
var FGEX = mongoose.model("Fgex", Fgex);
module.exports.FGEX = FGEX;