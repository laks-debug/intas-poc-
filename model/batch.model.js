const mongoose = require("mongoose");
var { FGEX } = require("../model/fgex.model");
const { changeOver } = require("./changeover.model");
const { changeOverMaster } = require("./changeovermaster.model");
var { Roster } = require("./roster.model");
var moment = require("moment");
var batchskutrigger = new mongoose.Schema(
  {
    start_time: {
      type: Date,
      required: true,
      default: Date.now(),
    },
    start_date: {
      type: Date,
    },
    end_date: {
      type: Date,
    },
    // target_quantity: {
    //   type: Number,
    // },
    product_name: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fgex",
    },
    po_number:{
      type:String
    },
    line_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "line",
    },
    batch: {
      type: String,
      unique: true,
    },
    batch_set_by: {
      type: String,
      default: "Sap",
    },
    batch_end_type: {
      type: String,
    },
    batch_end_time: {
      type: Date,
    },
    batch_end_by: {
      type: String,
    },
    production_end_time: {
      type: Date,
    },
    batch_end_from:{
      type:String
    },
    // format: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "format",
    // },
    batch_size: {
      type: Number,
    },
    end_time: {
      type: Date,
      default: null,
    },
    rated_speed: {
      type: Number,
    },
    remark:{
      type:String
    },
    end_case:{
      type:mongoose.Schema.Types.ObjectId,
      ref:"types"
    }
  },
  { timestamps: true }
);

var Batchskutrigger = mongoose.model("batchskutrigger", batchskutrigger);

var getCurrentBatch = async (line_id) => {
  var batch = await Batchskutrigger.findOne({line_id:line_id, end_time: null }).populate(
    "product_name"
  );
  if (!batch) {
    var check_batch = await Batchskutrigger.findOne({line_id:line_id})
    if (!check_batch) {
      var data = new Batchskutrigger({
        start_time: new Date(),
        batch_size: 28800,
        product_name: "5e53d256f931b906783a17c3",
        line_id: "5f0809fdc2b1ce30cc53eb8d",
        //format: "5ea94dd6b5959e13903d309e",
        batch: "intial",
      });
      var result = await data.save();
      return result;
    } else {
        return null
    }
  }
  return batch;
};
//post auto Batch
var postAutoSku = async (line_id, shift, d) => {
  var batch = await Batchskutrigger.findOne({ end_time: null });
  var changeover = await changeOver.findOne({ batch_name: batch.batch });
  //console.log("roma" , changeover);
  var timestamp = new Date();
  var system_batch_id = "NMX12" + moment().local().format("YYYY-MM-DD-HH:mm");
  var operator_name =
    (await Roster.findOne(
      { date: d },
      { shift_wise: { $elemMatch: { shift_name: shift } } }
    ).operator_name) || null;
  var changeover_type = await changeOverMaster.findOne({
    changeover_type: "Type A",
  });
  // console.log(changeover_type);
  // batch.isactive = false;
  batch.end_time = new Date();
  batch.end_date = timestamp;
  batch.save();
  //create new Changeover
  var new_changeover = new changeOver({
    product_id: changeover.product_id,
    fgex: changeover.fgex,
    line_id: line_id,
    changeover_start_date: new Date(),
    batch_size: 100000,
    pre_batch: changeover.batch_name,
    changeover_type_id: changeover_type._id,
    pre_product_id: changeover.product_id,
    shift: shift,
    date: d,
    operator: operator_name,
    batch_name: system_batch_id,
    shift_wise: [
      {
        date: d,
        shift: shift,
        changeover_start_time: timestamp,
        opertor: operator_name,
      },
    ],
  });
  new_changeover.save();
  //create new Batch
  var new_batch = new Batchskutrigger({
    start_time: moment().format("YYYY-MM-DDTHH:mm:ss"),
    //target_quantity: target_quantity,
    start_date: d,
    batch_size: 100000,
    line_id: line_id,
    product_name: changeover.product_id,
    batch: system_batch_id,
  });
  //console.log(new_batch);
  var result = await new_batch.save();
  console.log(result);
};
var postSkuTrigger = async (
  batch_name,
  product,
  batch_size,
  line_id,
  start_date
) => {
  console.log(batch_name, product, batch_size, line_id, start_date);
  var batch = await Batchskutrigger.findOne({ end_time: null });
  // batch.isactive = false;
  batch.end_time = new Date();
  batch.end_date = start_date;
  batch.save();
  var new_batch = new Batchskutrigger({
    start_time: moment().format("YYYY-MM-DDTHH:mm:ss"),
    //target_quantity: target_quantity,
    start_date: start_date,
    batch_size: batch_size,
    line_id: line_id,
    product_name: product,
    batch: batch_name,
  });
  //console.log(new_batch);
  var result = await new_batch.save();
  if (result) {
    return result;
  } else {
    return "duplicate";
  }
};

var MachineCheckSku = async () => {
  var arr = [];
  var data = await Batchskutrigger.findOne({ isactive: true }).populate({
    path: "sku",
    select: { _id: 0, equipments: 1 },
    populate: { path: "equipments", select: { _id: 0, equipment_name: 1 } },
  });
  //console.log(data)
  data.sku.equipments.forEach((element) => {
    arr.push(element.equipment_name);
  });
  return arr;
};

//change batch end 
var updateBatchEnd = async(line_id,batch_end_time,batch_end_type,batch_end_from,batch_end_by,remark,end_cause,cb)=>{
  var batch = await Batchskutrigger.findOne({ end_time: null,line_id:line_id });
  batch.batch_end_time = batch_end_time;
  batch.batch_end_type = batch_end_type;
  batch.batch_end_from = batch_end_from;
  batch.batch_end_by = batch_end_by;
  batch.remark = remark;
  batch.end_case = end_cause;
  var save = await batch.save();
  cb(save)
}
module.exports.Batchskutrigger = Batchskutrigger;
module.exports.getCurrentBatch = getCurrentBatch;
module.exports.postSkuTrigger = postSkuTrigger;
module.exports.MachineCheckSku = MachineCheckSku;
module.exports.postAutoSku = postAutoSku;
module.exports.updateBatchEnd = updateBatchEnd;
