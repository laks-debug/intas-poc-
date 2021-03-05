var express = require("express");
var mongoose = require("mongoose");
var moment = require("moment");
var router = express.Router();
var { Project } = require("../model/project.model");
var { Batchskutrigger } = require("../model/batch.model");
var { changeOver } = require("../model/changeover.model");
var fault_obj = require("../fault.json");
//batch wise report
router.get("/batch", async (req, res) => {
  var line_id = req.query.line_id;
  var batch = req.query.batch;
  var end;
  var batch_data = await Batchskutrigger.findOne({ batch: batch })
    .populate("format")
    .populate("product_name");
  var changeover = await changeOver
    .findOne({ batch_name: batch })
    .populate("line_id");
  //console.log(changeover)
  var batch = batch_data._id;
  var start;
  if(batch_data.start_date){
	  start = moment(batch_data.start_date).format("YYYY-MM-DD");
  }else{
	  start = moment(batch_data.start_time).local().format("YYYY-MM-DD");
  }
  var batch_end;
  if (!batch_data.end_time) {
    end = moment().local().format("YYYY-MM-DD");
    batch_end = moment().local().format();
  } else {
    end = moment(batch_data.end_time).local().format("YYYY-MM-DD");
    batch_end = moment(batch_data.end_time).local().format();
  }
  var data = await Project.aggregate([
    {
      $match: {
        line_id: mongoose.Types.ObjectId(line_id),
        $and: [
          {
            date: {
              $lte: new Date(end),
            },
          },
          {
            date: {
              $gte: new Date(start),
            },
          },
        ],
      },
    },
    { $unwind: "$shift_wise" },
    {
      $lookup: {
        from: "operators",
        localField: "shift_wise.operator_name",
        foreignField: "_id",
        as: "operator_name",
      },
    },
    {
      $unwind: {
        path: "$operator_name",
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
      $match: {
        "shift_wise.batch_wise.batch": mongoose.Types.ObjectId(batch),
      },
    },
    {
      $unwind: {
        path: "$shift_wise.batch_wise.machine_wise",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        line_id: "$line_id",
        shift: "$shift_wise.shift_name",
        machine_name: "$shift_wise.batch_wise.machine_wise.machine_name",
        goodCount: "$shift_wise.batch_wise.machine_wise.goodCount",
        reject_count: "$shift_wise.batch_wise.machine_wise.reject_count",
        fault: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "fault"] },
          },
        },
        date: "$date",
        changeover: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "changeover"] },
          },
        },
        blocked: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "blocked"] },
          },
        },
        pdt: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "pdt"] },
          },
        },
        manual_stop: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "manual_stop"] },
          },
        },
        updt: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "updt"] },
          },
        },
        waiting: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "waiting"] },
          },
        },
        operator_name: {
          $ifNull: ["$operator_name", "Not Defined"],
        },
        batch_start: "$shift_wise.batch_wise.start_timestamp",
        batch_end: {
          $ifNull: ["$shift_wise.batch_wise.end_timestamp", new Date()],
        },
      },
    },
    {
      $unwind: {
        path: "$waiting",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$changeover",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$pdt",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$updt",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$blocked",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$manual_stop",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$fault",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        line_id: 1,
        rated_speed: 1,
        isCurrent: 1,
        machine_name: 1,
        goodCount: 1,
        reject_count: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        fault: 1,
        blocked: 1,
        waiting: 1,
        updt: 1,
        pdt: 1,
        changeover: 1,
        manual_stop: 1,
        major_fault: {
          $filter: {
            input: "$fault.details",
            as: "stop",
            cond: { $eq: ["$$stop.duration_type", "major"] },
          },
        },
        minor_fault: {
          $filter: {
            input: "$fault.details",
            as: "stop",
            cond: { $eq: ["$$stop.duration_type", "minor"] },
          },
        },
        major_manual_stop: {
          $filter: {
            input: "$manual_stop.details",
            as: "stop",
            cond: { $eq: ["$$stop.duration_type", "major"] },
          },
        },
        minor_manual_stop: {
          $filter: {
            input: "$manual_stop.details",
            as: "stop",
            cond: { $eq: ["$$stop.duration_type", "minor"] },
          },
        },
        total_batch_duration: {
          $round: [
            {
              $divide: [
                {
                  $subtract: ["$batch_end", "$batch_start"],
                },
                1000 * 60,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $unwind: {
        path: "$major_manual_stop",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$minor_manual_stop",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$major_fault",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$minor_fault",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: {
          shift: "$shift",
          date: "$date",
          machine_name: "$machine_name",
          operator_name: "$operator_name",
        },
        goodCount: { $sum: "$goodCount" },
        reject_count: { $sum: "$reject_count" },
        blocked: { $sum: "$blocked.duration" },
        blocked_count: { $sum: "$blocked.count" },
        waiting: { $sum: "$waiting.duration" },
        waiting_count: { $sum: "$waiting.count" },
        major_manual_stop: { $sum: "$major_manual_stop.duration" },
        major_manual_stop_count: { $sum: "$major_manual_stop.count" },
        minor_manual_stop: { $sum: "$minor_manual_stop.duration" },
        minor_manual_stop_count: { $sum: "$minor_manual_stop.count" },
        pdt: { $sum: "$pdt.duration" },
        pdt_count: { $sum: "$pdt.count" },
        updt: { $sum: "$updt.duration" },
        updt_count: { $sum: "$updt.count" },
        changeover: { $sum: "$changeover.duration" },
        changeover_count: { $sum: "$changeover.count" },
        major_fault: { $sum: "$major_fault.duration" },
        major_fault_count: { $sum: "$major_fault.count" },
        minor_fault: { $sum: "$minor_fault.duration" },
        minor_fault_count: { $sum: "$minor_fault.count" },
        total_batch_duration: { $sum: "$total_batch_duration" },
        fault_arr: {
          $push: "$major_fault.duration_details",
        },
      },
    },
    {
      $group: {
        _id: "$_id.date",
        shift: {
          $push: {
            shift: "$_id.shift",
            machine_name: "$_id.machine_name",
            operator_name: "$_id.operator_name",
            fault_arr: "$fault_arr",
            goodCount: "$goodCount",
            reject_count: "$reject_count",
            blocked: "$blocked",
            blocked_count: "$blocked_count",
            waiting: "$waiting",
            waiting_count: "$waiting_count",
            manual_stop: "$manual_stop",
            manual_stop_count: "$manual_stop_count",
            pdt: "$pdt",
            pdt_count: "$pdt_count",
            updt: "$updt",
            updt_count: "$updt_count",
            changeover: "$changeover",
            changeover_count: "$changeover_count",
            major_fault: "$major_fault",
            major_fault_count: "$major_fault_count",
            minor_fault: "$minor_fault",
            minor_fault_count: "$minor_fault_count",
            major_manual_stop: "$major_manual_stop",
            major_manual_stop_count: "$major_manual_stop_count",
            minor_manual_stop: "$minor_manual_stop",
            minor_manual_stop_count: "$minor_manual_stop_count",
            total_batch_duration: "$total_batch_duration",
          },
        },
      },
    },
    {
      $unwind: {
        path: "$shift",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: "$shift.machine_name",
        goodCount: { $sum: "$shift.goodCount" },
        reject_count: { $sum: "$shift.reject_count" },
        blocked: { $sum: "$shift.blocked" },
        blocked_count: { $sum: "$shift.blocked_count" },
        waiting: { $sum: "$shift.waiting" },
        waiting_count: { $sum: "$shift.waiting_count" },
        manual_stop: { $sum: "$shift.manual_stop" },
        manual_stop_count: { $sum: "$shift.manual_stop_count" },
        pdt: { $sum: "$shift.pdt" },
        pdt_count: { $sum: "$shift.pdt_count" },
        changeover: { $sum: "$shift.changeover" },
        changeover_count: { $sum: "$shift.changeover_count" },
        updt: { $sum: "$shift.updt" },
        updt_count: { $sum: "$shift.updt_count" },
        major_manual_stop: { $sum: "$shift.major_manual_stop" },
        major_manual_stop_count: { $sum: "$shift.major_manual_stop_count" },
        minor_manual_stop: { $sum: "$shift.minor_manual_stop" },
        minor_manual_stop_count: { $sum: "$shift.minor_manual_stop_count" },
        major_fault: { $sum: "$shift.major_fault" },
        major_fault_count: { $sum: "$shift.major_fault_count" },
        minor_fault: { $sum: "$shift.minor_fault" },
        minor_fault_count: { $sum: "$shift.minor_fault_count" },
        total_batch_duration: { $sum: "$shift.total_batch_duration" },
        fault_arr: {
          $push: "$shift.fault_arr",
        },
        shift_wise: {
          $push: {
            shift: "$shift.shift",
            goodCount: "$shift.goodCount",
            date: "$_id",
            reject_count: "$shift.reject_count",
            operator_name: "$shift.operator_name",
          },
        },
      },
    },
    {
      $unwind: {
        path: "$fault_arr",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$fault_arr",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$fault_arr",
        preserveNullAndEmptyArrays: true,
      },
    },
    // {
    //   $match: {
    //     fault_arr: {
    //       $ne: null,
    //     },
    //   },
    // },
    {
      $project: {
        _id: 1,
        goodCount: 1,
        reject_count: 1,
        shift_wise: 1,
        blocked: 1,
        blocked_count: 1,
        waiting: 1,
        waiting_count: 1,
        major_manual_stop: 1,
        major_manual_stop_count: 1,
        minor_manual_stop: 1,
        minor_manual_stop_count: 1,
        pdt: 1,
        pdt_count: 1,
        updt: 1,
        updt_count: 1,
        changeover: 1,
        changeover_count: 1,
        major_fault: 1,
        major_fault_count: 1,
        minor_fault: 1,
        minor_fault_count: 1,
        total_batch_duration: 1,
        fault_arr: 1,
      },
    },
    {
      $group: {
        _id: {
          machine_name: "$_id",
          fault_name: "$fault_arr.fault_name",
        },
        duration: { $sum: "$fault_arr.duration" },
        count: { $sum: "$fault_arr.count" },
        parent_arr: {
          $push: {
            goodCount: "$goodCount",
            reject_count: "$reject_count",
            blocked: "$blocked",
            blocked_count: "$blocked_count",
            waiting: "$waiting",
            waiting_count: "$waiting_count",
            pdt: "$pdt",
            pdt_count: "$pdt_count",
            updt: "$updt",
            updt_count: "$updt_count",
            changeover: "$changeover",
            changeover_count: "$changeover_count",
            major_fault: "$major_fault",
            major_fault_count: "$major_fault_count",
            minor_fault: "$minor_fault",
            minor_fault_count: "$minor_fault_count",
            major_manual_stop: "$major_manual_stop",
            major_manual_stop_count: "$major_manual_stop_count",
            minor_manual_stop: "$minor_manual_stop",
            minor_manual_stop_count: "$minor_manual_stop_count",
            total_batch_duration: "$total_batch_duration",
            shift_wise: "$shift_wise",
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id.machine_name",
        fault_arr: {
          $push: {
            fault_name: "$_id.fault_name",
            duration: "$duration",
            count: "$count",
          },
        },
        parent_arr: { $addToSet: "$parent_arr" },
      },
    },
    {
      $project: {
        machine_name: "$_id",
        fault_arr: "$fault_arr",
        parent_arr: { $arrayElemAt: ["$parent_arr", 0] },
      },
    },
    {
      $project: {
        machine_name: "$_id",
        fault_arr: "$fault_arr",
        parent_arr: { $arrayElemAt: ["$parent_arr", 0] },
      },
    },
    {
      $unwind: {
        path: "$parent_arr",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        machine_name: 1,
        fault_arr: 1,
        goodCount: "$parent_arr.goodCount",
        reject_count: "$parent_arr.reject_count",
        blocked: "$parent_arr.blocked",
        blocked_count: "$parent_arr.blocked_count",
        waiting: "$parent_arr.waiting",
        waiting_count: "$parent_arr.waiting_count",
        pdt: "$parent_arr.pdt",
        pdt_count: "$parent_arr.pdt_count",
        updt: "$parent_arr.updt",
        updt_count: "$parent_arr.updt_count",
        shift_wise: "$parent_arr.shift_wise",
        changeover: "$parent_arr.changeover",
        major_fault: "$parent_arr.major_fault",
        major_fault_count: "$parent_arr.major_fault_count",
        minor_fault: "$parent_arr.minor_fault",
        minor_fault_count: "$parent_arr.minor_fault_count",
        major_manual_stop: "$parent_arr.major_manual_stop",
        major_manual_stop_count: "$parent_arr.major_manual_stop_count",
        minor_manual_stop: "$parent_arr.minor_manual_stop",
        minor_manual_stop_count: "$parent_arr.minor_manual_stop_count",
        total_batch_duration: "$parent_arr.total_batch_duration",
      },
    },
  ]);
  var send_data = {};
  send_data["fault"] = {};
  send_data["date"] = {};
  send_data["operator"] = {};
  send_data["changeover_duration"] = {};
  send_data["actual_production_time"] = {};
  send_data["batch"] = {};
  send_data["batch_size"] = {};
  send_data["shift_good"] = {};
  send_data["fgex"] = {};
  send_data["product"] = {};
  send_data["idle"] = {};
  send_data["speed_loss"] = {};
  send_data["waiting"] = {};
  send_data["blocked"] = {};
  send_data["changeover"] = {};
  send_data["pdt"] = {};
  send_data["updt"] = {};
  send_data["manual_stop"] = {};
  send_data["oee"] = {};
  send_data["performance"] = {};
  send_data["quality"] = {};
  send_data["aviability"] = {};
  send_data["mttr"] = {};
  send_data["mtbf"] = {};
  send_data["count"] = {};
  send_data["minor_fault"] = {};
  send_data["minor_fault_count"] = {};
  send_data["minor_manual_stop"] = {};
  send_data["minor_manual_stop_count"] = {};
  send_data["speed_loss"] = {};
  send_data["totalTheoreticalTime"] = {};
  send_data["totalPlanProdTime"] = {};
  send_data["netOperatingTime"] = {};
  send_data["grossOperatingTime"] = {};
  send_data["inProcessRejectTime"] = {};
  send_data["changeOverWastageTime"] = {};
  send_data["productiveTime"] = {};
  send_data["changeover_wastage"] = {};
  var batch_duration = moment.duration(
    moment(batch_end).diff(moment(batch_data.start_time))
  );
  var changeover_format = moment.duration(
    moment(changeover.changeover_end_date).diff(
      moment(changeover.changeover_start_date)
    )
  );
  data.forEach((element, i) => {
    var sort_arr = element.fault_arr.sort((a, b) => {
      return b.duration - a.duration;
    });
    var operator = "";
    var shift_good = "";
    var shift_wise_arr = element.shift_wise.sort((a, b) => {
      return a.shift - b.shift || a.date - b.date;
    });
    shift_wise_arr.forEach((data) => {
      operator += `${data.shift} / ${
        data.operator_name.display_name || "Not Defined"
      };  `;
      shift_good += `${data.shift} - ${data.goodCount}/${data.reject_count};  `;
    });
    var cal_data = calculation(
      element.goodCount,
      element.reject_count,
      element.total_batch_duration,
      element.pdt,
      element.changeover,
      element.updt,
      element.major_fault,
      element.major_fault_count,
      element.minor_fault,
      element.major_manual_stop,
      element.minor_manual_stop,
      element.blocked,
      element.waiting,
      batch_data.product_name.rated_speed,
      0
    );
    send_data["fault"][element._id] = `${
      element.major_fault_count
    } / ${convertHHMM(element.major_fault)}`;
    send_data["date"][element._id] = `${moment(batch_data.start_time).format(
      "DD-MM-YY - HH:mm:00"
    )} To ${moment(batch_end).format("DD-MM-YY - HH:mm:00")} / ${Math.floor(
      batch_duration.asHours()
    )} Hours ${Math.floor(batch_duration.asMinutes() % 60)} Minutes`;
    send_data["operator"][element._id] = operator;
    send_data["shift_good"][element._id] = shift_good;
    send_data["batch"][element._id] = batch_data.batch;
    send_data["fgex"][element._id] =
      batch_data.product_name.fgex +
      " / " +
      batch_data.batch +
      " / " +
      batch_data.product_name.product_name;
    send_data["product"][element._id] = batch_data.product_name.product_name;
    send_data["actual_production_time"][element._id] = cal_data.production_time;
    send_data["speed_loss"][element._id] = cal_data.speed_loss;
    send_data["idle"][element._id] =
      element.minor_manual_stop_count +
      element.blocked_count +
      element.waiting_count +
      element.minor_fault_count +
      " / " +
      cal_data.idel_time;
    send_data["totalTheoreticalTime"][element._id] = cal_data.total_time;
    send_data["totalPlanProdTime"][element._id] = cal_data.working_time;
    send_data["netOperatingTime"][element._id] = cal_data.net_operating_time;
    send_data["grossOperatingTime"][element._id] = cal_data.production_time;
    send_data["inProcessRejectTime"][element._id] = cal_data.reject_time;
    send_data["changeOverWastageTime"][element._id] =
      cal_data.changeover_wastage_time;
    send_data["productiveTime"][element._id] = cal_data.productive_time;
    send_data["batch_size"][element._id] = `${batch_data.batch_size} / ${(
      ((element.goodCount + element.reject_count) / batch_data.batch_size) *
      100
    ).toFixed(2)}%`;
    send_data["changeover_duration"][element._id] = `${moment(
      changeover.changeover_start_date
    ).format("DD-MM-YY - HH:mm:00")} To ${moment(
      changeover.changeover_end_date
    ).format("DD-MM-YY - HH:mm:00")} / ${Math.floor(
      changeover_format.asHours()
    )} Hours ${Math.floor(changeover_format.asMinutes() % 60)} Minutes`;
    send_data["waiting"][element._id] = `  ${
      element.waiting_count
    } / ${convertHHMM(element.waiting)}`;
    send_data["count"][
      element._id
    ] = `${element.goodCount} / ${element.reject_count}`;
    send_data["blocked"][element._id] = `${
      element.blocked_count
    } / ${convertHHMM(element.blocked)}`;
    send_data["changeover"][element._id] = `${convertHHMM(
      element.changeover
    )} `;
    send_data["manual_stop"][element._id] = `${
      element.major_manual_stop_count
    } / ${convertHHMM(element.major_manual_stop)}`;
    send_data["pdt"][element._id] = `${element.pdt_count} / ${convertHHMM(
      element.pdt
    )} `;
    send_data["updt"][element._id] = `${element.updt_count} / ${convertHHMM(
      element.updt
    )}`;
    send_data["minor_fault"][element._id] = `${
      element.minor_fault_count
    } / ${convertHHMM(element.minor_fault)} `;
    send_data["minor_manual_stop"][element._id] = `${
      element.minor_manual_stop_count
    } / ${convertHHMM(element.minor_manual_stop)} `;
    send_data["oee"][element._id] = (cal_data.oee * 100).toFixed(2);
    send_data["aviability"][element._id] = (cal_data.aviability * 100).toFixed(
      2
    );
    send_data["performance"][element._id] = (
      cal_data.performance * 100
    ).toFixed(2);
    send_data["quality"][element._id] = (cal_data.quality * 100).toFixed(2);
    send_data["mttr"][element._id] = cal_data.mttr;
    send_data["mtbf"][element._id] = cal_data.mtbf;
    send_data["changeover_wastage"][element._id] = 0;
    var count = 1;
    sort_arr.forEach((fault) => {
      if (fault.fault_name) {
        send_data[`fault_${count}`] = send_data[`fault_${count}`] || {};
        send_data[`fault_${count}`][element._id] = `${
          fault_obj[element._id][fault.fault_name]
        }  ${fault.count} / ${convertHHMM(fault.duration)}`;
        count++;
      }
    });
    res.send(send_data);
  });
});

//shift wise report
router.get("/shift", async (req, res) => {
  var line_id = req.query.line_id;
  var shift = req.query.shift;
  var date = req.query.date;
  var total_time = 480 * 60;
  var data = await Project.aggregate([
    {
      $match: {
        line_id: mongoose.Types.ObjectId(line_id),
        date: new Date(date),
      },
    },
    { $unwind: "$shift_wise" },
    {
      $match: {
        "shift_wise.shift_name": shift,
      },
    },
    {
      $lookup: {
        from: "operators",
        localField: "shift_wise.operator_name",
        foreignField: "_id",
        as: "operator_name",
      },
    },
    {
      $unwind: {
        path: "$operator_name",
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
        localField: "shift_wise.batch_wise.batch",
        foreignField: "_id",
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
      $lookup: {
        from: "fgexes",
        localField: "batch.product_name",
        foreignField: "_id",
        as: "fgex",
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
        path: "$shift_wise.batch_wise.machine_wise",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        line_id: "$line_id",
        shift: "$shift_wise.shift_name",
        machine_name: "$shift_wise.batch_wise.machine_wise.machine_name",
        goodCount: "$shift_wise.batch_wise.machine_wise.goodCount",
        reject_count: "$shift_wise.batch_wise.machine_wise.reject_count",
        startup_reject: "$shift_wise.batch_wise.machine_wise.startup_reject:",
        fault: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "fault"] },
          },
        },
        date: "$date",
        changeover: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "changeover"] },
          },
        },
        blocked: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "blocked"] },
          },
        },
        pdt: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "pdt"] },
          },
        },
        manual_stop: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "manual_stop"] },
          },
        },
        updt: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "updt"] },
          },
        },
        waiting: {
          $filter: {
            input: "$shift_wise.batch_wise.machine_wise.stop_wise",
            as: "stop",
            cond: { $eq: ["$$stop.stop_name", "waiting"] },
          },
        },
        operator_name: {
          $ifNull: ["$operator_name", "Not Defined"],
        },
        batch_start: "$shift_wise.batch_wise.start_timestamp",
        batch_end: {
          $ifNull: ["$shift_wise.batch_wise.end_timestamp", new Date()],
        },
        rated_speed: {
          $ifNull: ["$fgex.rated_speed", 60],
        },
        format: "$fgex.fgex",
        product: "$fgex.product_name",
        batch_name: "$batch.batch",
        batch_size: "$batch.batch_size",
      },
    },
    {
      $unwind: {
        path: "$waiting",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$changeover",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$pdt",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$updt",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$blocked",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$manual_stop",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$fault",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        line_id: 1,
        rated_speed: 1,
        isCurrent: 1,
        machine_name: 1,
        goodCount: 1,
        reject_count: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        fault: 1,
        blocked: 1,
        waiting: 1,
        updt: 1,
        pdt: 1,
        format: 1,
        product: 1,
        changeover: 1,
        manual_stop: 1,
        startup_reject: 1,
        major_fault: {
          $filter: {
            input: "$fault.details",
            as: "stop",
            cond: { $eq: ["$$stop.duration_type", "major"] },
          },
        },
        minor_fault: {
          $filter: {
            input: "$fault.details",
            as: "stop",
            cond: { $eq: ["$$stop.duration_type", "minor"] },
          },
        },
        major_manual_stop: {
          $filter: {
            input: "$manual_stop.details",
            as: "stop",
            cond: { $eq: ["$$stop.duration_type", "major"] },
          },
        },
        minor_manual_stop: {
          $filter: {
            input: "$manual_stop.details",
            as: "stop",
            cond: { $eq: ["$$stop.duration_type", "minor"] },
          },
        },
        batch_start: 1,
        batch_end: 1,
        batch_size: 1,
        batch_name: 1,
        total_batch_duration: {
          $round: [
            {
              $divide: [
                {
                  $subtract: ["$batch_end", "$batch_start"],
                },
                1000,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $unwind: {
        path: "$major_manual_stop",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$minor_manual_stop",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$major_fault",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$minor_fault",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        line_id: 1,
        rated_speed: {
          $divide: ["$rated_speed", 60],
        },
        format: 1,
        product: 1,
        machine_name: 1,
        goodCount: 1,
        reject_count: 1,
        batch_name: 1,
        batch_size: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        batch_start: 1,
        batch_end: 1,
        startup_reject: 1,
        blocked: "$blocked.duration",
        blocked_count: "$blocked.count",
        waiting: "$waiting.duration",
        waiting_count: "$waiting.count",
        pdt: "$pdt.duration",
        pdt_count: "$pdt.count",
        updt: "$updt.duration",
        updt_count: "$updt.count",
        changeover: "$changeover.duration",
        changeover_count: "$changeover.count",
        major_fault: "$major_fault.duration",
        major_fault_count: "$major_fault.count",
        minor_fault: "$minor_fault.duration",
        minor_fault_count: "$minor_fault.count",
        major_manual_stop: "$major_manual_stop.duration",
        major_manual_stop_count: "$major_manual_stop.count",
        minor_manual_stop: "$minor_manual_stop.duration",
        minor_manual_stop_count: "$minor_manual_stop.count",
        working_time: {
          $round: [
            {
              $subtract: [
                "$total_batch_duration",
                {
                  $sum: ["$pdt.duration", "$updt.duration"],
                },
              ],
            },
            0,
          ],
        },
        production_time: {
          $round: [
            {
              $subtract: [
                "$total_batch_duration",
                {
                  $sum: [
                    "$pdt.duration",
                    "$updt.duration",
                    "$major_fault.duration",
                    "$major_manual_stop.duration",
                    "$changeover.duration",
                  ],
                },
              ],
            },
            0,
          ],
        },
        total_batch_duration: 1,
        idle_time: {
          $sum: [
            "$blocked.duration",
            "$waiting.duration",
            "$minor_fault.duration",
            "$minor_manual_stop.duration",
          ],
        },
        idle_count: {
          $sum: [
            "$blocked.count",
            "$waiting.count",
            "$minor_fault.count",
            "$minor_manual_stop.count",
          ],
        },
        fault_arr: "$major_fault.duration_details",
      },
    },
    {
      $project: {
        line_id: 1,
        rated_speed: 1,
        format: 1,
        product: 1,
        machine_name: 1,
        idle_time: 1,
        idle_count: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        batch_name: 1,
        batch_size: 1,
        batch_start: 1,
        batch_end: 1,
        startup_reject: 1,
        working_time: 1,
        goodCount: "$goodCount",
        reject_count: "$reject_count",
        blocked: 1,
        blocked_count: 1,
        waiting: 1,
        waiting_count: 1,
        major_manual_stop: 1,
        major_manual_stop_count: 1,
        minor_manual_stop: 1,
        minor_manual_stop_count: 1,
        pdt: 1,
        fault_arr: "$fault_arr",
        pdt_count: 1,
        updt: 1,
        updt_count: 1,
        changeover: 1,
        changeover_count: 1,
        production_time: 1,
        total_batch_duration: 1,
        major_fault: 1,
        major_fault_count: 1,
        minor_fault: 1,
        minor_fault_count: 1,
        producion_time: 1,
        performance_time: {
          $cond: [
            {
              $or: [
                {
                  $lte: ["$production_time", 0],
                },
                { $lte: [{ $sum: ["$goodCount", "$reject_count"] }, 0] },
              ],
            },
            0,
            {
              $round: [
                {
                  $subtract: [
                    "$producion_time",
                    {
                      $divide: [
                        { $sum: ["$goodCount", "$reject_count"] },
                        "$rated_speed",
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          ],
        },
      },
      reject_time: {
        $round: [
          {
            $divide: ["$reject_count", "$rated_speed"],
          },
          0,
        ],
      },
      changeover_wastage_time: {
        $round: [
          {
            $divide: ["$rstartup_reject", "$rated_speed"],
          },
          0,
        ],
      },
    },
    {
      $project: {
        line_id: 1,
        rated_speed: 1,
        format: 1,
        product: 1,
        machine_name: 1,
        idle_time: 1,
        idle_count: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        batch_name: 1,
        batch_size: 1,
        batch_start: 1,
        batch_end: 1,
        startup_reject: 1,
        working_time: 1,
        goodCount: 1,
        reject_count: 1,
        blocked: 1,
        blocked_count: 1,
        waiting: 1,
        waiting_count: 1,
        major_manual_stop: 1,
        major_manual_stop_count: 1,
        minor_manual_stop: 1,
        minor_manual_stop_count: 1,
        pdt: 1,
        fault_arr: 1,
        pdt_count: 1,
        updt: 1,
        updt_count: 1,
        changeover: 1,
        changeover_count: 1,
        production_time: 1,
        total_batch_duration: 1,
        major_fault: 1,
        major_fault_count: 1,
        minor_fault: 1,
        minor_fault_count: 1,
        changeover_wastage_time: 1,
        reject_time: 1,
        performance_time: 1,
        speed_loss: {
          $subtract: ["$performance_time", "idle_time"],
        },
        net_operating_time: {
          $subtract: ["$production_time", "$performance_time"],
        },
      },
    },
    {
      $project: {
        line_id: 1,
        rated_speed: 1,
        format: 1,
        product: 1,
        machine_name: 1,
        idle_time: 1,
        idle_count: 1,
        operator_name: 1,
        date: 1,
        shift: 1,
        batch_name: 1,
        batch_size: 1,
        batch_start: 1,
        batch_end: 1,
        startup_reject: 1,
        working_time: 1,
        goodCount: 1,
        reject_count: 1,
        blocked: 1,
        blocked_count: 1,
        waiting: 1,
        waiting_count: 1,
        major_manual_stop: 1,
        major_manual_stop_count: 1,
        minor_manual_stop: 1,
        minor_manual_stop_count: 1,
        pdt: 1,
        fault_arr: 1,
        pdt_count: 1,
        updt: 1,
        updt_count: 1,
        changeover: 1,
        changeover_count: 1,
        production_time: 1,
        total_batch_duration: 1,
        major_fault: 1,
        major_fault_count: 1,
        minor_fault: 1,
        minor_fault_count: 1,
        changeover_wastage_time: 1,
        reject_time: 1,
        performance_time: 1,
        speed_loss: 1,
        net_operating_time: 1,
        productive_time: {
          $subtract: [
            "$net_operating_time",
            {
              $sum: ["$reject_time", "$changeover_wastage_time"],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$machine_name",
        goodCount: { $sum: "$goodCount" },
        reject_count: { $sum: "$reject_count" },
        performance: { $sum: "$performance" },
        blocked: { $sum: "$blocked" },
        blocked_count: { $sum: "$blocked_count" },
        waiting: { $sum: "$waiting" },
        waiting_count: { $sum: "$waiting_count" },
        working_time: { $sum: "$working_time" },
        manual_stop: { $sum: "$manual_stop" },
        manual_stop_count: { $sum: "$manual_stop_count" },
        pdt: { $sum: "$pdt" },
        pdt_count: { $sum: "$pdt_count" },
        updt: { $sum: "$updt" },
        updt_count: { $sum: "$updt_count" },
        productive_time: { $sum: "$productive_time" },
        net_operating_time: { $sum: "$net_operating_time" },
        speed_loss: { $sum: "$speed_loss" },
        performance_time: { $sum: "$performance_time" },
        reject_time: { $sum: "$reject_time" },
        changeover_wastage_time: { $sum: "$changeover_wastage_time" },
        idle_time: { $sum: "$idle_time" },
        total_batch_duration: { $sum: "$total_batch_duration" },
        production_time: { $sum: "$production_time" },
        startup_reject: { $sum: "$startup_reject" },
        idle_count: { $sum: "$idle_count" },
        changeover: { $sum: "$changeover" },
        changeover_count: { $sum: "$changeover_count" },
        major_manual_stop: { $sum: "$major_manual_stop" },
        major_manual_stop_count: { $sum: "$major_manual_stop_count" },
        minor_manual_stop: { $sum: "$minor_manual_stop" },
        minor_manual_stop_count: { $sum: "$minor_manual_stop_count" },
        major_fault: { $sum: "$major_fault" },
        major_fault_count: { $sum: "$major_fault_count" },
        minor_fault: { $sum: "$minor_fault" },
        minor_fault_count: { $sum: "$minor_fault_count" },
        fault_arr: {
          $push: "$fault_arr",
        },
        batch_wise: {
          $push: {
            rated_speed: "$rated_speed",
            format: "$format",
            product: "$product",
            batch: "$batch_name",
            batch_size: "$batch_size",
            operator_name: "$operator_name",
            batch_start: "$batch_start",
            batch_end: "$batch_end",
            changeover: "$changover",
            major_fault: "$major_fault",
            changeover: "$changeover",
            major_manual_stop: "$major_manual_stop",
            performance: "$performance",
            total_batch_duration: "$total_batch_duration",
            total_time: "$total_time",
            pdt: "$pdt",
            updt: "$updt",
            goodCount: "$goodCount",
            reject_count: "$reject_count",
            productive_time: "$productive_time",
            net_operating_time: "$net_operating_time",
            speed_loss: "$speed_loss",
            performance_time: "$performance_time",
            reject_time: "$reject_time",
            changeover_wastage_time: "$changeover_wastage_time",
            idle_time: "$idle_time",
            total_batch_duration: "$total_batch_duration",
            production_time: "$production_time",
            startup_reject: "$startup_reject",
            idle_count: "$idle_count",
            working_time: "$working_time",
          },
        },
      },
    },
    {
      $project: {},
    },
    {
      $unwind: {
        path: "$fault_arr",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $unwind: {
        path: "$fault_arr",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: {
          machine_name: "$_id",
          fault_name: "$fault_arr.fault_name",
        },
        duration: { $sum: "$fault_arr.duration" },
        count: { $sum: "$fault_arr.count" },
        parent_arr: {
          $push: {
            goodCount: "$goodCount",
            reject_count: "$reject_count",
            blocked: "$blocked",
            blocked_count: "$blocked_count",
            waiting: "$waiting",
            waiting_count: "$waiting_count",
            pdt: "$pdt",
            pdt_count: "$pdt_count",
            updt: "$updt",
            working_time: "$working_time",
            performance: "$performance",
            updt_count: "$updt_count",
            changeover: "$changeover",
            changeover_count: "$changeover_count",
            major_fault: "$major_fault",
            major_fault_count: "$major_fault_count",
            minor_fault: "$minor_fault",
            productive_time: "$productive_time",
            net_operating_time: "$net_operating_time",
            speed_loss: "$speed_loss",
            performance_time: "$performance_time",
            reject_time: "$reject_time",
            changeover_wastage_time: "$changeover_wastage_time",
            idle_time: "$idle_time",
            total_batch_duration: "$total_batch_duration",
            production_time: "$production_time",
            startup_reject: "$startup_reject",
            idle_count: "$idle_count",
            working_time: "$working_time",
            minor_fault_count: "$minor_fault_count",
            major_manual_stop: "$major_manual_stop",
            major_manual_stop_count: "$major_manual_stop_count",
            minor_manual_stop: "$minor_manual_stop",
            minor_manual_stop_count: "$minor_manual_stop_count",
            batch_wise: "$batch_wise",
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id.machine_name",
        fault_arr: {
          $push: {
            fault_name: "$_id.fault_name",
            duration: {
              $round: ["$duration", 2],
            },
            count: "$count",
          },
        },
        parent_arr: { $addToSet: "$parent_arr" },
      },
    },
    {
      $project: {
        machine_name: "$_id",
        fault_arr: "$fault_arr",
        parent_arr: { $arrayElemAt: ["$parent_arr", 0] },
      },
    },
    {
      $project: {
        machine_name: "$_id",
        fault_arr: "$fault_arr",
        parent_arr: { $arrayElemAt: ["$parent_arr", 0] },
      },
    },
    {
      $unwind: {
        path: "$parent_arr",
        preserveNullAndEmptyArrays: true,
      },
    },
  ]);
  //res.send(data)
  var send_data = {};
  send_data["fault"] = {};
  send_data["date"] = {};
  send_data["operator"] = {};
  send_data["shift"] = {};
  send_data["actual_production_time"] = {};
  send_data["batch"] = {};
  send_data["batch_size"] = {};
  send_data["batch_good"] = {};
  send_data["waiting"] = {};
  send_data["blocked"] = {};
  send_data["changeover"] = {};
  send_data["changeover_wastage"] = {};
  send_data["pdt"] = {};
  send_data["updt"] = {};
  send_data["manual_stop"] = {};
  send_data["oee"] = {};
  send_data["performance"] = {};
  send_data["quality"] = {};
  send_data["aviability"] = {};
  send_data["mttr"] = {};
  send_data["mtbf"] = {};
  send_data["count"] = {};
  send_data["speed_loss"] = {};
  send_data["idle"] = {};
  send_data["totalTheoreticalTime"] = {};
  send_data["totalPlanProdTime"] = {};
  send_data["netOperatingTime"] = {};
  send_data["grossOperatingTime"] = {};
  send_data["inProcessRejectTime"] = {};
  send_data["changeOverWastageTime"] = {};
  send_data["productiveTime"] = {};
  send_data["changeover_wastage"] = {};
  send_data["batch_details"] = {};
  //  var batch_duration = moment.duration(moment(batch_end).diff(moment(batch_data.start_time)));
  //  var changeover_format = moment.duration(moment(changeover.end_time).diff(moment(changeover.start_time)));
  data.forEach((element, i) => {
    var sort_arr = element.fault_arr.sort((a, b) => {
      return b.duration - a.duration;
    });
    var batch_format = "";
    var batch_good = "";
    var batch_size = "";
    var batch_wise_arr = element.parent_arr.batch_wise.sort((a, b) => {
      return b.batch_end - a.batch_start;
    });
    var operator = "";
    var batch_counter = 1;
    var batch_details = "";
    batch_wise_arr.forEach((data) => {
      var batch_duration = moment.duration(
        moment(data.batch_end).diff(moment(data.batch_start))
      );
      batch_details += `${data.batch} | ${moment(data.batch_start).format(
        "DD-MM-YY - HH:mm:00"
      )} To ${moment(data.batch_end).format(
        "DD-MM-YY - HH:mm:00"
      )} | ${Math.floor(batch_duration.asHours())} Hours ${Math.floor(
        batch_duration.asMinutes() % 60
      )} Minutes | ${data.format} | ${data.product} | ${data.goodCount} | ${
        data.reject_count
      } |  ${data.batch_size} | ${(
        (data.goodCount / data.batch_size) *
        100
      ).toFixed(2)} %;`;
      send_data[`batch_${batch_counter}`] =
        send_data[`fault_${batch_counter}`] || {};
      send_data[`batch_${batch_counter}`][element._id] = `${
        data.batch
      } ${moment(data.batch_start).format("DD-MM-YY - HH:mm:00")} To ${moment(
        data.batch_end
      ).format("DD-MM-YY - HH:mm:00")} | ${Math.floor(
        batch_duration.asHours()
      )} Hours ${Math.floor(batch_duration.asMinutes() % 60)} Minutes`;
      batch_format += `${data.batch} | ${data.format} | ${data.product};  `;
      batch_good += `${data.batch} | ${data.goodCount} | ${data.reject_count};  `;
      batch_size += `${data.batch} | ${data.batch_size} | ${(
        (data.goodCount / data.batch_size) *
        100
      ).toFixed(2)} %;`;
      operator = data.operator_name.display_name;
      batch_counter++;
    });
    //console.log(element.parent_arr)
    var cal_data = Shiftcalculation(
      element.parent_arr.total_batch_duration,
      element.parent_arr.working_time,
      element.parent_arr.production_time,
      element.parent_arr.performance_time,
      element.parent_arr.netOperatingTime,
      element.parent_arr.idle_time,
      element.parent_arr.reject_time,
      element.parent_arr.changeover_wastage_time,
      element.parent_arr.productive_time,
    );
    send_data["fault"][element._id] = `${
      element.parent_arr.major_fault_count
    } / ${convertHHMM(element.parent_arr.major_fault)} `;
    send_data["date"][element._id] = date;
    send_data["shift"][element._id] = `${shift} / ${batch_wise_arr.length}`;
    send_data["operator"][element._id] = operator;
    send_data["batch_good"][element._id] = batch_good;
    send_data["batch_details"][element._id] = batch_details;
    send_data["batch"][element._id] = batch_format;
    send_data["actual_production_time"][element._id] = cal_data.production_time;
    send_data["changeover_wastage"][element._id] = 0;
    send_data["batch_size"][element._id] = batch_size;
    send_data["waiting"][element._id] = `${
      element.parent_arr.waiting_count
    } / ${convertHHMM(element.parent_arr.waiting)}`;
    send_data["count"][
      element._id
    ] = `${element.parent_arr.goodCount} / ${element.parent_arr.reject_count}`;
    send_data["blocked"][element._id] = `${
      element.parent_arr.blocked_count
    } / ${convertHHMM(element.parent_arr.blocked)}`;
    send_data["changeover"][element._id] = `${
      element.parent_arr.changeover_count
    } / ${convertHHMM(element.parent_arr.changeover)} `;
    send_data["manual_stop"][element._id] = `${
      element.parent_arr.major_manual_stop_count
    } / ${convertHHMM(element.parent_arr.major_manual_stop)} `;
    send_data["pdt"][element._id] = `${
      element.parent_arr.pdt_count
    } / ${convertHHMM(element.parent_arr.pdt)}`;
    send_data["updt"][element._id] = `${
      element.parent_arr.updt_count
    } / ${convertHHMM(element.parent_arr.updt)}`;
    send_data["oee"][element._id] = (cal_data.oee * 100).toFixed(2);
    send_data["aviability"][element._id] = (cal_data.aviability * 100).toFixed(
      2
    );
    send_data["performance"][element._id] = (
      cal_data.performance * 100
    ).toFixed(2);
    var mtbf = convertHHMM(MttrValidation(Math.round(element.parent_arr.working_time / element.parent_arr.major_fault_count)));
    var mttr = convertHHMM(MttrValidation(Math.round(
      element.parent_arr.major_fault / element.parent_arr.major_fault_count
    )));
    send_data["quality"][element._id] = (cal_data.quality * 100).toFixed(2);
    send_data["mttr"][element._id] = mttr;
    send_data["mtbf"][element._id] = mtbf;
    send_data["speed_loss"][element._id] = cal.speed_loss;
    send_data["idle"][element._id] =  element.parent_arr.idle_count +' / '+ cal.idle_time ;
    send_data["totalTheoreticalTime"][element._id] = cal.total_time;
    send_data["totalPlanProdTime"][element._id] = cal.working_time;
    send_data["netOperatingTime"][element._id] = cal.net_operating_time;
    send_data["grossOperatingTime"][element._id] = cal.production_time;
    send_data["inProcessRejectTime"][element._id] = cal.reject_time;
    send_data["changeOverWastageTime"][element._id] = cal.changeover_wastage_time;
    send_data["productiveTime"][element._id] = cal.productive_time;
    var count = 1;
    sort_arr.forEach((fault) => {
      if (fault.fault_name) {
        send_data[`fault_${count}`] = send_data[`fault_${count}`] || {};
        send_data[`fault_${count}`][element._id] = `${
          fault_obj[element._id][fault.fault_name]
        }  ${fault.count} / ${convertHHMM(fault.duration)}`;
        count++;
      }
    });
    res.send(send_data);
  });
});

function calculation(
  goodCount,
  reject_count,
  total_batch_time,
  pdt,
  changeover,
  updt,
  major_fault,
  major_fault_count,
  minor_fault,
  major_manual_stop,
  minor_manual_stop,
  blocked,
  waiting,
  rated_speed,
  changeover_reject
) {
  //console.log(goodCount, reject_count, total_batch_time, pdt, changeover, updt, major_fault, major_fault_count,minor_fault,major_manual_stop,minor_manual_stop, rated_speed)
  var data = {};
  var total_count = goodCount + reject_count;
  var working_time = total_batch_time * 60 - pdt - updt;
  var production_time =
    working_time - major_fault - major_manual_stop - changeover;
  if (production_time < 70) {
    production_time = 0;
  }
  var performance_time =
    convertMinutes(production_time) - total_count / rated_speed;
  var reject_time = Math.floor((reject_count / rated_speed) * 60);
  var changeover_wastage_time = Math.floor(
    (changeover_reject / rated_speed) * 60
  );
  var idle_time = blocked + waiting + minor_manual_stop + minor_fault;
  //console.log(performance_time)
  var speed_loss = performance_time * 60 - idle_time;
  var net_operating_time = production_time - idle_time - speed_loss;
  var productive_time =
    net_operating_time - reject_time - changeover_wastage_time;
  data.performance = checkValidation(
    total_count / (rated_speed * convertMinutes(production_time))
  );
  data.quality = checkValidation(goodCount / total_count);
  data.aviability = checkValidation(production_time / working_time);
  data.idel_time = convertHHMM(idle_time);
  data.working_time = convertHHMM(working_time);
  data.speed_loss = convertHHMM(Math.floor(speed_loss));
  data.performance_time = convertHHMM(Math.floor(performance_time * 60));
  data.oee = data.quality * data.aviability * data.performance;
  data.mtbf = convertHHMM(
    MttrValidation(Math.round(working_time / major_fault_count))
  );
  data.mttr = convertHHMM(
    MttrValidation(Math.round(major_fault / major_fault_count))
  );
  data.production_time = convertHHMM(Math.round(production_time));
  data.total_time = convertHHMM(total_batch_time * 60);
  data.reject_time = convertHHMM(reject_time);
  data.changeover_wastage_time = convertHHMM(changeover_wastage_time);
  data.net_operating_time = convertHHMM(Math.floor(net_operating_time));
  data.productive_time = convertHHMM(Math.floor(productive_time));
  return data;
}
//shift wise calulatio
function Shiftcalculation(
  total_batch_time,
  working_time,
  production_time,
  performance_time,
  net_operating_time,
  idle_time,
  reject_time,
  changeover_wastage_time,
  productive_time
) {
  var data = {};
  var speed_loss = performance_time - idle_time;
  if (speed_loss < 70) {
    speed_loss = 0;
  }
  data.performance = checkValidation(net_operating_time / production_time);
  data.quality = checkValidation(productive_time / net_operating_time);
  data.aviability = checkValidation(production_time / working_time);
  data.idle_time = convertHHMM(idle_time);
  data.working_time = convertHHMM(working_time);
  data.speed_loss = convertHHMM(Math.floor(speed_loss));
  data.performance_time = convertHHMM(Math.floor(performance_time));
  data.oee = data.quality * data.aviability * data.performance;
  //data.mtbf = convertHHMM(MttrValidation(Math.round(working_time / major_fault_count)));
  //data.mttr = convertHHMM(MttrValidation(Math.round(major_fault / major_fault_count)));
  data.production_time = convertHHMM(Math.round(production_time));
  data.total_time = convertHHMM(total_batch_time);
  data.reject_time = convertHHMM(reject_time);
  data.changeover_wastage_time = convertHHMM(changeover_wastage_time);
  data.net_operating_time = convertHHMM(Math.floor(net_operating_time));
  data.productive_time = convertHHMM(Math.floor(productive_time));
  return data;
}
//
function checkValidation(value) {
  if (value < 0 || value === Infinity || !value) {
    return 0;
  } else if (value > 1) {
    return 1;
  } else {
    return value;
  }
}

function MttrValidation(value) {
  if (value < 0 || value === Infinity || !value) {
    return 0;
  } else {
    return value;
  }
}

function convertHHMM(totalSeconds) {
  h = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  m = Math.floor(totalSeconds / 60);
  s = totalSeconds % 60;
  return checkNumber(h) + ":" + checkNumber(m) + ":" + checkNumber(s);
}

function checkNumber(number) {
  if (number < 10) {
    return `0${number}`;
  } else {
    return number;
  }
}
function convertMinutes(totalSeconds) {
  h = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  m = Math.floor(totalSeconds / 60);
  return h * 60 + m;
}
module.exports = router;
