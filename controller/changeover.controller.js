var express = require("express");
var moment = require("moment");
var router = express.Router();
var {
  changeOver,
  changesku,
  updateChangeOver,
} = require("../model/changeover.model");
var {
  Batchskutrigger,
  postSkuTrigger,
  updateBatchEnd,
} = require("../model/batch.model");
const { EventEmitter } = require("events");
var { Type } = require("../model/type.model");
var { Sap } = require("../model/sap.model");
var { addToQue, Que, removeFromQue } = require("../model/que.model");
var { FGEX } = require("../model/fgex.model");
var mongoose = require("mongoose");
var { Roster } = require("../model/roster.model");
var { SkuMaster } = require("../model/product.model");
var { CurrentShift } = require("../model/shift.model");
var { changeOverMaster } = require("../model/changeovermaster.model");
var {
  updateChangeoverMode,
  updateMode,
  TempGood,
} = require("../model/goodTemp.model");
var { Condition, getCondition } = require("../model/status.model");
//var { maintananaceMailer,ChangeovermailFormatter } = require('./email.controller');
const e = new EventEmitter();
var critical_machine = "cam_blister";

router.get("/current", async (req, res) => {
  var data = await changeOver
    .findOne({ changeover_end_date: null })
    .populate("changeover_type_id")
    .populate("product_id");
  if (data) {
    data.changeover_start_date = moment(data.changeover_start_date)
      .local()
      .format("YYYY-MM-DDTHH:mm:ss");
    res.send(data);
  } else {
    res.send("no changeover running");
  }
});

router.get("/roo", async (req, res) => {
  var curretshitordate = await CurrentShift();
  var shift = curretshitordate.shift;
  var d = curretshitordate.date;
  console.log(shift, d);
  //var get_opretor = await Roster.findOne({date:d})
  //console.log(get_opretor.shift_wise);
  var data = await Roster.find(
    { date: d },
    { shift_wise: { $elemMatch: { shift_name: shift } } }
  );
  console.log(data[0].shift_wise[0].operator_name);
  res.send(data);
});

router.get("/changeoverreport", async (req, res) => {
  var line_id = req.query.line_id;
  var startDate = moment(req.query.startDate).format("YYYY-MM-DDTHH:mm:ss");
  var endDate = moment(req.query.endDate).format("YYYY-MM-DDTHH:mm:ss");
  var data = await changeOver.aggregate([
    {
      $match: {
        $and: [
          {
            changeover_start_date: {
              $lte: new Date(endDate),
            },
          },
          {
            changeover_start_date: {
              $gte: new Date(startDate),
            },
          },
        ],
        changeover_end_date: { $ne: null },
      },
    },
    {
      $lookup: {
        from: "changeovermasters",
        localField: "changeover_type_id",
        foreignField: "_id",
        as: "type",
      },
    },
    {
      $lookup: {
        from: "lines",
        localField: "line_id",
        foreignField: "_id",
        as: "line",
      },
    },
    {
      $lookup: {
        from: "fgexes",
        localField: "product_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $lookup: {
        from: "fgexes",
        localField: "pre_product_id",
        foreignField: "_id",
        as: "pre_product",
      },
    },
    {
      $lookup: {
        from: "equipment",
        let: { machine: critical_machine },
        pipeline: [
          { $match: { $expr: { $eq: ["$equipment_name", "$$machine"] } } },
        ],
        as: "machine",
      },
    },
    {
      $unwind: {
        path: "$shift_wise",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$pre_product",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$type",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$product",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$line",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$machine",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "rosters",
        let: { date: "$shift_wise.date", shift: "$shift_wise.shift" },
        pipeline: [
          { $match: { $expr: { $eq: ["$date", "$$date"] } } },
          {
            $project: {
              operator: {
                $filter: {
                  input: "$shift_wise",
                  as: "shift_name",
                  cond: { $eq: ["$$shift_name.shift_name", "$$shift"] },
                },
              },
            },
          },
          {
            $unwind: {
              path: "$operator",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "operators",
              let: { operator_name: "$operator.operator_name" },
              pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$operator_name"] } } },
              ],
              as: "operator",
            },
          },
          {
            $unwind: {
              path: "$operator",
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
        as: "roster",
      },
    },
    {
      $lookup: {
        from: "projects",
        let: {
          date: "$shift_wise.date",
          shift: "$shift_wise.shift",
          batch: "$batch_name",
        },
        pipeline: [
          { $match: { $expr: { $eq: ["$date", "$$date"] } } },
          {
            $project: {
              shift_wise: {
                $filter: {
                  input: "$shift_wise",
                  as: "shift_name",
                  cond: { $eq: ["$$shift_name.shift_name", "$$shift"] },
                },
              },
            },
          },
          {
            $unwind: {
              path: "$shift_wise",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $unwind: {
              path: "$shift_wise.batch_wise",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "batchskutriggers",
              let: { batch_name: "$shift_wise.batch_wise.batch" },
              pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$batch_name"] } } },
              ],
              as: "batch",
            },
          },
          {
            $unwind: {
              path: "$batch",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $match: {
              $expr: {
                $eq: ["$batch.batch", "$$batch"],
              },
            },
          },
          {
            $project: {
              machine_wise: {
                $filter: {
                  input: "$shift_wise.batch_wise.machine_wise",
                  as: "machine_wise",
                  cond: {
                    $eq: ["$$machine_wise.machine_name", critical_machine],
                  },
                },
              },
            },
          },
          {
            $unwind: {
              path: "$machine_wise",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              changeover_wastage: "$machine_wise.startup_reject",
            },
          },
        ],
        as: "project",
      },
    },
    {
      $unwind: {
        path: "$roster",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$project",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        changeover_wastage: {
          $ifNull: ["$project.changeover_wastage", 0],
        },
        operator_name: {
          $ifNull: ["$roster.operator.display_name", "Operator Not Defined"],
        },
        date: { $ifNull: ["$shift_wise.date", "$date"] },
        shift_quality_power_off: {
          $ifNull: ["$shift_wise.quality_power_off", 0],
        },
        shift_mechanical_power_off: {
          $ifNull: ["$shift_wise.mechanical_power_off", 0],
        },
        mechanical_power_off: { $ifNull: ["$mechanical_power_off", 0] },
        quality_power_off: { $ifNull: ["$quality_power_off", 0] },
        shift: { $ifNull: ["$shift_wise.shift", "$shift"] },
        line: "$line.line_name",
        changeover_finish_type: { $ifNull: ["$finished_type", "manual"] },
        batch_name: "$batch_name",
        batch_size: "$batch_size",
        changeover_start_date: "$changeover_start_date",
        changeover_end_date: { $ifNull: ["$changeover_end_date", new Date()] },
        changeover_finish: {
          $ifNull: ["$changeover_finished", "$changeover_end_date"],
        },
        type: "$type.changeover_name",
        standard_duration: "$type.standard_duration",
        shift_changeover_start_time: {
          $ifNull: [
            "$shift_wise.changeover_start_time",
            "$changeover_start_date",
          ],
        },
        shift_changeover_end_time: {
          $ifNull: ["$shift_wise.changeover_end_time", "$changeover_end_date"],
        },
        machine_name: "$machine.display_name",
        product_name: "$product.product_name",
        from_fgex: "$product.fgex",
        to_fgex: "$pre_product.fgex",
      },
    },
    {
      $project: {
        changeover_wastage: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        line: 1,
        changeover_finish_type: 1,
        batch_name: 1,
        batch_size: 1,
        changeover_finish_time: {
          $dateToString: {
            format: "%Y-%m-%dT%H:%M:%S.%L",
            date: "$changeover_finish",
            timezone: "+05:30",
          },
        },
        type: 1,
        standard_duration: {
          $multiply: ["$standard_duration", 60],
        },
        machine_name: 1,
        product_name: 1,
        from_fgex: 1,
        mechanical_power_off: 1,
        quality_power_off: 1,
        shift_mechanical_power_off: 1,
        shift_quality_power_off: 1,
        to_fgex: 1,
        shift_changeover_start_time: {
          $dateToString: {
            format: "%Y-%m-%dT%H:%M:%S.%L",
            date: "$shift_changeover_start_time",
            timezone: "+05:30",
          },
        },
        shift_changeover_end_time: {
          $dateToString: {
            format: "%Y-%m-%dT%H:%M:%S.%L",
            date: "$shift_changeover_end_time",
            timezone: "+05:30",
          },
        },
        changeover_start_time: {
          $dateToString: {
            format: "%Y-%m-%dT%H:%M:%S.%L",
            date: "$changeover_start_date",
            timezone: "+05:30",
          },
        },
        production_start: {
          $dateToString: {
            format: "%Y-%m-%dT%H:%M:%S.%L",
            date: "$changeover_end_date",
            timezone: "+05:30",
          },
        },
        actual_total_time: {
          $round: [
            {
              $subtract: [
                {
                  $divide: [
                    {
                      $subtract: [
                        "$changeover_end_date",
                        "$changeover_start_date",
                      ],
                    },
                    1000,
                  ],
                },
                {
                  $sum: ["$mechanical_power_off", "$quality_power_off"],
                },
              ],
            },
            0,
          ],
        },
        shift_actual_time: {
          $round: [
            {
              $subtract: [
                {
                  $divide: [
                    {
                      $subtract: [
                        "$shift_changeover_end_time",
                        "$shift_changeover_start_time",
                      ],
                    },
                    1000,
                  ],
                },
                {
                  $sum: [
                    "$shift_mechanical_power_off",
                    "$shift_quality_power_off",
                  ],
                },
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        changeover_wastage: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        line: 1,
        changeover_finish_type: 1,
        batch_name: 1,
        batch_size: 1,
        changeover_finish_time: 1,
        type: 1,
        standard_duration: 1,
        machine_name: 1,
        product_name: 1,
        from_fgex: 1,
        mechanical_power_off: 1,
        quality_power_off: 1,
        shift_mechanical_power_off: 1,
        shift_quality_power_off: 1,
        to_fgex: 1,
        shift_changeover_start_time: 1,
        shift_changeover_end_time: 1,
        changeover_start_time: 1,
        production_start: 1,
        actual_total_time: 1,
        shift_actual_time: 1,
        changeover_split: {
          $divide: ["$standard_duration", "$actual_total_time"],
        },
      },
    },
    {
      $project: {
        changeover_wastage: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        line: 1,
        changeover_finish_type: 1,
        batch_name: 1,
        batch_size: 1,
        changeover_finish_time: 1,
        type: 1,
        standard_duration: 1,
        machine_name: 1,
        product_name: 1,
        from_fgex: 1,
        mechanical_power_off: 1,
        quality_power_off: 1,
        shift_mechanical_power_off: 1,
        shift_quality_power_off: 1,
        to_fgex: 1,
        shift_changeover_start_time: 1,
        shift_changeover_end_time: 1,
        changeover_start_time: 1,
        production_start: 1,
        actual_total_time: 1,
        standard_duration_split: {
          $multiply: ["$changeover_split", "$shift_actual_time"],
        },
        shift_actual_time: 1,
        changeover_split: 1,
      },
    },
  ]);
  res.send(data);
});

router.post("/batchEnd", async (req, res) => {
  var { line_id, type, remark, end_cause, user_name } = req.body;
  var timestamp = moment().format("YYYY-MM-DDTHH:mm:ss");
  updateBatchEnd(
    line_id,

    timestamp,
    type,
    "supervisor_screen",
    user_name,
    remark,
    end_cause,
    () => {
      updateMode(line_id, type, () => {
        global.changeSkuManualEntry = false;
        res.send({
          update: "ok",
        });
      });
    }
  );
});

//add to que
router.post("/queue", async (req, res) => {
  var { line_id, po_id, fgex, halb_code, user_name } = req.body;
  let checkFgex = await FGEX.findOne({ fgex: fgex, halb_code: halb_code });
  if (!checkFgex) {
    res.status(404).send("Fgex not found in master,Please add on Master");
    return;
  }
  addToQue({ line_id: line_id, po_id: po_id, fgex: checkFgex._id }, (data) => {
    res.send(data);
  });
});
//get Api
router.get("/dashboard", async (req, res) => {
  var line_id = req.query.line_id;
  var data = await Batchskutrigger.aggregate([
    {
      $match: {
        end_time: null,
      },
    },
    {
      $lookup: {
        from: "fgexes",
        localField: "product_name",
        foreignField: "_id",
        as: "fgex",
      },
    },
    {
      $lookup: {
        from: "ques",
        localField: "line_id",
        foreignField: "line_id",
        as: "que",
      },
    },
    {
      $lookup: {
        from: "tempgoods",
        let: { line_id: "$line_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$line_id", "$$line_id"],
                  },
                  {
                    $eq: ["$machine", critical_machine],
                  },
                ],
              },
            },
          },
        ],
        as: "temp",
      },
    },
    {
      $unwind: {
        path: "$fgex",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$temp",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$que",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "rosters",
        let: { date: "$temp.date", shift: "$temp.current_shift" },
        pipeline: [
          { $match: { $expr: { $eq: ["$date", "$$date"] } } },
          {
            $project: {
              operator: {
                $filter: {
                  input: "$shift_wise",
                  as: "shift_name",
                  cond: { $eq: ["$$shift_name.shift_name", "$$shift"] },
                },
              },
            },
          },
          {
            $unwind: {
              path: "$operator",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "operators",
              let: { operator_name: "$operator.operator_name" },
              pipeline: [
                { $match: { $expr: { $eq: ["$_id", "$$operator_name"] } } },
              ],
              as: "operator",
            },
          },
          {
            $unwind: {
              path: "$operator",
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
        as: "roster",
      },
    },
    {
      $lookup: {
        from: "fgexes",
        localField: "que.fgex",
        foreignField: "_id",
        as: "que_fgex",
      },
    },
    {
      $lookup: {
        from: "lines",
        localField: "line_id",
        foreignField: "_id",
        as: "line",
      },
    },
    {
      $lookup: {
        from: "saps",
        localField: "que.po_id",
        foreignField: "_id",
        as: "que_po",
      },
    },
    {
      $unwind: {
        path: "$roster",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$que_po",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$que_fgex",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$line",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project:{
        PONumber:"$po_number",
        lotNumber:"$batch",
        lotSize:"$batch_size",
        plant:"Matoda",
        fgex:"$fgex.fgex",
        product:"$fgex.product_name",
        ratedSpeed:"$fgex.rated_speed",
        halb_code:"$fgex.halb_code",
        lineNumber:"$line.line_code",
        lineId:"$line._id",
        currentMode:"$temp.machine_mode",
        po_id:null,
        goodCount:{
          $multiply:[
            {
              $subtract:["$temp.current_no_of_case", "$temp.batch_start_no_of_case"]
            },
            "$fgex.No_of_blisters"
          ]
        },
        poStatus :'assigned',
        startDate:"$fgex.start_time",
        currentOperator:{
          $ifNull:["$roster.operator.display_name","Not Defined"]
        },
        totalProdHrsNeeded:"0",
        likelydateTime:"0",
        queue:{
          fgex:"$que_fgex.fgex",
          product:"$que_fgex.product_name",
          ratedSpeed:"$que_fgex.rated_speed",
          halb_code:"$que_fgex.halb_code",
          poStatus :'queue',
          PONumber:"$que_po.PONumber",
          lotNumber:"$que_po.LOTNumber",
          po_id:"$que_po._id",
          lotSize:"$que_po.LOTSize",
         totalProdHrsNeeded:null,
         likelydateTime:null,
         startDate:null,
         goodCount:null,
         currentMode:"$temp.machine_mode",
         lineNumber:"$line.line_code",
         lineId:"$line._id",
         plant:"Matoda",
        }
      }
    }
  ]);
  var send_arr = [];
  data.forEach((element,i) => {
     var queue = element.queue;
     element.queue = {};
     queue.fgex ? send_arr.push(element,queue) : send_arr.push(element);
     if(data.length  == (i + 1)){
      res.send(send_arr);
     }
  });
  
});
router.post("/", async (req, res) => {
  let timestamp = moment().format("YYYY-MM-DDTHH:mm:ss");
  let { fgex, po_id, line_id, halb_code, user_name } = req.body;
  let checkFgex = await FGEX.findOne({ fgex: fgex, halb_code: halb_code });
  let checkBatchEnd = await TempGood.findOne({ line_id: line_id });
  var batch_obj = {};
  var pre_batch = await Batchskutrigger.findOne({
    line_id: line_id,
    end_time: null,
  }).populate("product_name");
  var sap = await Sap.findOne({ _id: po_id });
  if (!sap) {
    res.status(404).send("Po Number Not found");
    return;
  }
  var { PONumber, LOTNumber, LOTSize } = sap;
  if (!checkFgex) {
    res.status(404).send("Fgex not found in master,Please add on Master");
  } else if (
    checkBatchEnd.machine_mode == "production" ||
    checkBatchEnd.machine_mode == "changeover" ||
    checkBatchEnd.machine_mode == "updt"
  ) {
    res.status(401).send("Please end batch first");
  } else if (LOTNumber == pre_batch.batch) {
    res.status(401).send("Duplicate Batch Number");
  } else {
    var changeover_obj = {};
    var pre_fgex = pre_batch.product_name.fgex;
    var pre_halb_code = pre_batch.product_name.halb_code;
    var pre_layout = pre_batch.product_name.layout_no;
    var changeover_type = await getTypeOfChangeover({
      pre_fgex: pre_fgex,
      pre_halb_code: pre_halb_code,
      pre_layout: pre_layout,
      fgex: checkFgex.fgex,
      halb_code: checkFgex.halb_code,
      layout: checkFgex.layout_no,
    });
    var currentShift = await CurrentShift();
    var shift = currentShift.shift;
    var d = currentShift.date;
    var get_op = await Roster.find(
      { date: d },
      { shift_wise: { $elemMatch: { shift_name: shift } } }
    );
    var operator;
    if (get_op[0] && get_op[0].shift_wise.length > 0) {
      if (get_op[0].shift_wise[0].operator_name) {
        operator = get_op[0].shift_wise[0].operator_name;
      } else {
        operator = null;
      }
    } else {
      operator = null;
    }
    //changeover data
    changeover_obj.line_id = line_id;
    changeover_obj.changeover_start_date = timestamp;
    changeover_obj.batch_name = LOTNumber;
    changeover_obj.batch_size = LOTSize;
    changeover_obj.changeover_type_id = changeover_type._id;
    changeover_obj.standard_duration = changeover_type.standard_duration;
    changeover_obj.product_id = checkFgex._id;
    changeover_obj.fgex = checkFgex.fgex;
    changeover_obj.pre_batch = pre_batch.batch;
    changeover_obj.pre_product_id = pre_batch.product_name._id;
    changeover_obj.shift = shift;
    changeover_obj.date = d;
    changeover_obj.operator = operator;
    changeover_obj.shift_wise = [
      {
        date: d,
        shift: shift,
        changeover_start_time: timestamp,
        opertor: operator,
      },
    ];
    var raw = new changeOver(changeover_obj);
    console.log(raw);
    //batch data
    batch_obj.start_time = timestamp;
    batch_obj.start_date = d;
    batch_obj.product_name = checkFgex._id;
    batch_obj.po_number = PONumber;
    batch_obj.line_id = line_id;
    batch_obj.batch = LOTNumber;
    batch_obj.batch_set_by = user_name;
    batch_obj.batch_size = LOTSize;
    var new_batch = new Batchskutrigger(batch_obj);
    new_batch.save();

    //pre_bacth
    pre_batch.end_time = timestamp;
    pre_batch.end_date = d;
    pre_batch.save();

    //change sap sataus
    sap.current_status = "assigned";
    sap.save();
    try {
      global.changeSkuManualEntry = true;
      updateChangeoverMode(
        critical_machine,
        line_id,
        global.changeSkuManualEntry
      );
      removeFromQue(sap._id, line_id);
      // var batch_result = await new_batch.save();
      var changeover_result = await raw.save();
      res.status(200).send(changeover_result);
    } catch (error) {
      res.status(400).send(error.message);
    }
  }
});

//type of changeover
const getTypeOfChangeover = async (obj) => {
  var type = "Product to Product";
  let { pre_fgex, fgex, pre_halb_code, halb_code, pre_layout, layout } = obj;
  //console.log(pre_fgex, fgex, pre_halb_code, halb_code, pre_layout, layout);
  if (pre_fgex == fgex && pre_halb_code == halb_code && pre_layout == layout) {
    type = "Batch to Batch";
  }
  if (pre_fgex != fgex && pre_halb_code == halb_code && pre_layout == layout) {
    type = "FGex Changeover";
  }
  var changeover_type_id = await changeOverMaster.findOne({
    changeover_name: type,
  });
  return new Promise((resolve, reject) => {
    resolve(changeover_type_id);
  });
};

module.exports = router;
