const request = require("request");
const dotenv = require("dotenv");
const logger = require("morgan");
const helmet = require("helmet");
const express = require("express");
var moment = require("moment");
var mongoose = require("mongoose");
var cors = require("cors");
var {
  updateStopData,
  addLineData,
  addShiftData,
  addMachineData,
  updateGoodCount,
  updateMaxBpm,
  batchEnd,
  updateStartupReject,
} = require("./model/project.model");
var {
  getCondition,
  updateCondition,
  Condition,
} = require("./model/status.model");
var { CurrentShift, updateShiftPosition } = require("./model/shift.model");
var {
  frequentGoodUpdate,
  getTempGood,
  preShift,
  updateChangeoverMode,
} = require("./model/goodTemp.model");
var { postStop, updateStop, updateLast, Stop } = require("./model/stop.model");
var { getCurrentBatch } = require("./model/batch.model");
var { getshiftWiseRoster, indexoperatorid } = require("./model/roster.model");
var { updateAlarm, updateAlarmStatus } = require("./model/alarm.model");
var {
  updateChangeOver,
  pushAndUpdateChangeover,
  updatePowerOff,
  getIsNullTrue,
} = require("./model/changeover.model");
var { updateConnection } = require("./model/connection.model");
var { addHistory } = require("./model/history.model");
//api controller
var shift = require("./controller/shift.controller");
var {batchEndMail,resetMail} = require("./controller/email.controller");
var {writeTagInPlc} = require("./controller/PlcWrite.controller");
var sku = require("./controller/sku.controller");
var stop = require("./controller/stops.controller");
var connection = require("./controller/connection.controller");
var manual = require("./controller/manualEntry.controller");
var alarm = require("./controller/alarm.controller");
var Changeover = require("./controller/changeover.controller");
var type = require("./controller/type.controller");
var report = require("./controller/report.controller");
var trend = require("./controller/trend.controller.js");
var Changeovermaster = require("./controller/changeovermaster.controller");
var fgex = require("./controller/fgex.controller");
var Threshhold = require("./controller/threshold.controller");
var sap = require("./controller/sap.controller");
var sapfgex = require("./controller/sapfgex.controller")
//global variable
const thing_data_map = {};
var line_id = "5f0809fdc2b1ce30cc53eb8d";
var operator_name;
var batch;
var fgex,pack,target;
var date_change_shift = "Shift C";
var critical_machine = "cam_blister";
var changeover_force_stop_count = 500;
global.changeSkuManualEntry = false;
const machine_state_obj = {};
var plc_timestamp = new Date();
var plc_status = true;
var batch_end_message = false;
var film_end_meassgae = false;
var target_end_message = false;
var target_end_timestamp;
var target_end_timer_message = false;
//express app
const app = express();

// Load environment variables from.env file, where API keys and passwords are configured.
dotenv.config({ path: "./.env" });

// Mongoose options
const mongoose_options = {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
};
mongoose
  .connect(process.env.MONGODB_OFFLINE_DB, mongoose_options)
  .then((connected) => console.log(`Database connection established`))
  .catch((err) =>
    console.error(
      `There was an error connecting to database, the err is ${err}`
    )
  );
//app
app.use(helmet());
//app.use(logger("dev"));

//thing array
const things = ["CAM1"];

//header for request
var header = {
  "content-type": "application/json",
  appKey: process.env.thingworx_appKey,
  Accept: "application/json",
};

//api
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(cors());
app.get("/", async (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});
//sap
app.get("/sap", async (req, res) => {
  res.sendFile(__dirname + "/public/sap.html");
});
//overview
app.get("/overview", async (req, res) => {
  res.sendFile(__dirname + "/public/overview.html");
});
app.use("/api/shift", shift);
app.use("/api/sku", sku);
app.use("/api/stops", stop);
app.use("/api/connection", connection);
app.use("/api/manual", manual);
app.use("/api/alarm", alarm);
app.use("/api/report", report);
app.use("/api/changeover", Changeover);
app.use("/api/type", type);
app.use("/api/trend", trend);
app.use("/api/changeovermaster", Changeovermaster);
app.use("/api/fgex", fgex);
app.use("/api/threshold", Threshhold);
app.use("/api/sap", sap);
app.use("/api/sap", sapfgex);

//Error Handling
app.use((req, res, next) => {
  const error = new Error("Not Found");
  error.status = 404;
  next(error);
});
//global error
app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    status: "error",
    res:error.message
  })
});
//get
async function processFunction(data) {
  var current_batch = await getCurrentBatch(line_id);
  //~console.log(fgex,pack,target)
  //console.log(batch);
  if (thing_data_map.hasOwnProperty("CAM1") && current_batch) {
    //console.log(thing_data_map.hasOwnProperty("CAM1"));
    //console.log(global.changeSkuManualEntry)
    batch = current_batch._id;
    fgex = current_batch.product_name._id;
    pack = current_batch.product_name.No_of_blisters;
    target = current_batch.batch_size;
    var data = await CurrentShift();
    var pre_shift = await preShift(critical_machine, line_id);
    var shift = data.shift;
    var d = data.date;
    //console.log(shift,d,pre_shift,thing_data_map)
    operator_name = await indexoperatorid(d, shift);
    var timestamp = moment().format("YYYY-MM-DDTHH:mm:ss");
    var mode = 1;
    var mode_obj = {
      1: thing_data_map.CAM1.INTAS_CAM1_StackGreen,
      2: thing_data_map.CAM1.INTAS_CAM1_IdleMode,
      3: global.changeSkuManualEntry,
    };
    var stop = 0;
    if (
      thing_data_map.CAM1.INTAS_CAM1_StackRed &&
      !thing_data_map.CAM1.INTAS_CAM1_LidMaterialEnd &&
      !thing_data_map.CAM1.INTAS_CAM1_FormFilmEnd
    ) {
      if (thing_data_map.CAM1.INTAS_CAM1_FirstFault > 0) {
        stop = thing_data_map.CAM1.INTAS_CAM1_FirstFault;
      } else {
        stop = 21;
      }
    }
    var waiting_obj = {
      0: false,
      1: thing_data_map.CAM1.INTAS_CAM1_LidMaterialEnd,
      2: thing_data_map.CAM1.INTAS_CAM1_FormFilmEnds,
    };
    var mode = object_filter(mode_obj);
    var wait = object_filter(waiting_obj);
    var case_count = thing_data_map.CAM1.INTAS_CAM1_T200GC;
    //when shift change
    if (shift != pre_shift) {
      updateShiftPosition(d);
      if (pre_shift == date_change_shift) {
        var date = moment().local().subtract(1, "days").startOf("day").format();
        var split = date.split("+");
        d = split[0] + "+00:00";
      }
      addstop(
        "cam_blister",
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        0,
        false,
        false,
        false,
        pre_shift,
        line_id,
        d,
        timestamp
      );
      goodCount(
        thing_data_map.CAM1.INTAS_CAM1_GoodCount,
        thing_data_map.CAM1.INTAS_CAM1_RejectCount1,
        "cam_blister",
        thing_data_map.CAM1.INTAS_CAM1_CycleBPM,
        mode,
        shift,
        batch,
        data.date,
        line_id,
        thing_data_map.CAM1.INTAS_CAM1_CycleCount,
        case_count,
        !thing_data_map.CAM1.INTAS_CAM1_StackGreen,
        thing_data_map.CAM1.INTAS_CAM1_LowProduct,
        thing_data_map.CAM1.INTAS_CAM1_FormFilmEnd,
        thing_data_map.CAM1.INTAS_CAM1_FaultAck,
      );
      return;
    }
    //when no shift change
    addstop(
      "cam_blister",
      false,
      global.changeSkuManualEntry,
      false,
      !thing_data_map.CAM1.INTAS_CAM1_PowerON,
      stop,
      thing_data_map.CAM1.INTAS_CAM1_OrangeBlinking,
      wait,
      thing_data_map.CAM1.INTAS_CAM1_FaultWarningScroll,
      thing_data_map.CAM1.INTAS_CAM1_ManualStop,
      thing_data_map.CAM1.INTAS_CAM1_StackGreen,
      true,
      shift,
      line_id,
      d,
      timestamp
    );
    goodCount(
      thing_data_map.CAM1.INTAS_CAM1_GoodCount,
      thing_data_map.CAM1.INTAS_CAM1_RejectCount1,
      "cam_blister",
      thing_data_map.CAM1.INTAS_CAM1_CycleBPM,
      mode,
      shift,
      batch,
      d,
      line_id,
      thing_data_map.CAM1.INTAS_CAM1_CycleCount,
      case_count,
      !thing_data_map.CAM1.INTAS_CAM1_StackGreen,
      thing_data_map.CAM1.INTAS_CAM1_LowProduct,
      thing_data_map.CAM1.INTAS_CAM1_FormFilmEnd,
      thing_data_map.CAM1.INTAS_CAM1_FaultAck,
    );
    if (!thing_data_map.CAM1.isConnected) {
      updateConnection("ipc_error", "cam_blister", line_id);
      return;
    }
    if ((plc_status ^ thing_data_map.CAM1.INTAS_CAM1_WatchDog) == 1) {
      plc_timestamp = new Date();
      plc_status = thing_data_map.CAM1.INTAS_CAM1_WatchDog;
    }
    if (new Date() - plc_timestamp > 30000) {
      updateConnection("plc_error", "cam_blister", line_id);
      return;
    }
    updateConnection("ok", "cam_blister", line_id);
  }
}

//add history data every 30 min

setInterval(async () => {
  var now = moment().local();
  var hour = now.hour();
  var minutes = hour * 60 + now.minutes();
  if (minutes % 30 == 0) {
    var shift_wise = await doRequest(
      `http://localhost:${process.env.PORT}/api/shift/shift/all?line_id=5f0809fdc2b1ce30cc53eb8d`
    );
    var batch_wise = await doRequest(
      `http://localhost:${process.env.PORT}/api/sku?line_id=5f0809fdc2b1ce30cc53eb8d`
    );
    addHistory({
      timestamp: moment().format("YYYY-MM-DDTHH:mm"),
      shift_wise: shift_wise[0],
      batch_wise: batch_wise[0],
    });
  }
}, 60 * 1000);

// function for good count
async function goodCount(
  good_count,
  reject_count,
  machine,
  bpm,
  mode,
  shift,
  batch,
  d,
  line_id,
  cycle_count,
  case_count,
  manual_stop,
  low_product,
  film_end,
  t200_state
) {
  var temp = await getTempGood(
    machine,
    line_id,
    shift,
    batch,
    good_count,
    reject_count
  );
  //updateChangeOver('automatic')
  var reset_counter = temp.current_good_value * 0.5;
  var date = d;
  //shift change all changes
  if (temp.current_shift != shift) {
    var pre_shift = temp.current_shift;
    if (pre_shift == date_change_shift) {
      var date = moment().local().subtract(1, "days").startOf("day").format();
      var split = date.split("+");
      date = split[0] + "+00:00";
    }
    var shift_good = good_count - temp.shift_start_good_count;
    var shift_case = case_count - temp.shift_start_no_of_case;
    var shift_reject;
    if (!temp.changeover_mode) {
      shift_reject = reject_count - temp.shift_start_reject_count;
    } else {
      shift_reject = 0;
      var changover_reject = reject_count - temp.shift_start_reject_count;
      updateStartupReject(
        line_id,
        date,
        pre_shift,
        batch,
        machine,
        changover_reject,
        () => {}
      );
      pushAndUpdateChangeover(shift, operator_name, d, () => {});
    }
    updateGoodCount(
      line_id,
      date,
      pre_shift,
      batch,
      machine,
      shift_good,
      shift_reject,
      shift_case,
      () => {
        batchEnd(line_id, date, pre_shift, () => {
          frequentGoodUpdate(machine, line_id, {
            shift_start_good_count: good_count,
            shift_start_reject_count: reject_count,
            shift_start_cycle_count: cycle_count,
            shift_start_no_of_case:case_count,
            current_good_value: good_count,
            current_reject_value: reject_count,
            current_no_of_case:case_count,
            current_shift: shift,
            date:d
          });
          addMachineData(
            line_id,
            d,
            shift,
            operator_name,
            batch,
            machine,
            () => {
              //can do operation after shift end process
            }
          );
        });
      }
    );
    return;
  }
  //if batch will change
  if (temp.currnt_batch.toString() != batch) {
    var shift_good = good_count - temp.shift_start_good_count;
    var shift_reject = reject_count - temp.shift_start_reject_count;
    var shift_case = case_count - temp.shift_start_no_of_case;
    //console.log(shift_reject)
    updateGoodCount(
      line_id,
      date,
      shift,
      temp.currnt_batch,
      machine,
      shift_good,
      shift_reject,
      shift_case,
      () => {
        frequentGoodUpdate(machine, line_id, {
          shift_start_good_count: good_count,
          shift_start_reject_count: reject_count,
          shift_start_no_of_case:case_count,
          current_no_of_case:case_count,
          batch_start_no_of_case:case_count,
          current_good_value: good_count,
          current_reject_value: reject_count,
          currnt_batch: batch,
        });
        addMachineData(line_id, d, shift, operator_name, batch, machine, () => {
          //can do operation after batch end process
        });
      }
    );
    return;
  }
  //if count is greater than 500 OR changover global is false
  if (
    (!global.changeSkuManualEntry ||
      good_count - temp.shift_start_good_count > changeover_force_stop_count) &&
    temp.changeover_mode
  ) {
    var changeover_reject = reject_count - temp.shift_start_reject_count;
    // console.log(
    //   temp.changeover_mode,
    //   global.changeSkuManualEntry,
    //   "From here",
    //   changeover_reject
    // );
    if (
      good_count - temp.shift_start_good_count >
      changeover_force_stop_count
    ) {
      updateChangeOver("automatic", (data) => {});
    }
    updateStartupReject(
      line_id,
      d,
      shift,
      batch,
      machine,
      changeover_reject,
      () => {}
    );
    global.changeSkuManualEntry = false;
    temp.changeover_mode = false;
    batch_end_message = false;
    film_end_meassgae = false;
    target_end_message = false;
    target_end_timer_message = false;
    temp.shift_start_reject_count = reject_count;
    temp.current_good_value = good_count;
    temp.current_cycle_count = cycle_count;
    temp.current_reject_value = reject_count;
    temp.machine_mode = 'production';
    temp.bpm = bpm;
    temp.mode = mode;
    temp.save();
    return;
  }
  //check production end 
  var band = ((temp.current_no_of_case - temp.batch_start_no_of_case) * pack) / target
  //console.log(band,temp.current_no_of_case,temp.batch_start_no_of_case,pack,target);
  //email of with product end product end 
  if( band > 0.95  && manual_stop && low_product && t200_state && !batch_end_message){
      //batchEndMail(band,t200_state,low_product,film_end,(temp.current_no_of_case - temp.batch_start_no_of_case),target,`Production End signal receive from logic at ${moment().local().format("DD-MM-YYYYTHH:mm:ss")}`);
      batch_end_message = true;
  }

  //when first time production end signal recieve
  if( band > 0.95  && manual_stop && t200_state && (temp.current_no_of_case - case_count == 0)){
    if(!target_end_message){
      target_end_timestamp = new Date();
      target_end_message = true;
      //batchEndMail(band,t200_state,low_product,film_end,(temp.current_no_of_case - temp.batch_start_no_of_case),target,`Production End signal without Low Product ${moment().local().format("DD-MM-YYYYTHH:mm:ss")}`);
    }
   }else{
      if(target_end_message){
        //resetMail(band > 0.95 ,t200_state,(temp.current_no_of_case - case_count == 0),manual_stop,`Reset Condition at ${moment().local().format("DD-MM-YYYYTHH:mm:ss")}`)
      }      
       target_end_timestamp = new Date();
       target_end_message = false;  
   }
   //will deliver after 10 min 
   //console.log(target_end_timestamp,new Date() - target_end_timestamp,target_end_message)
   if(target_end_timestamp && (new Date() - target_end_timestamp >= 600000) && !target_end_timer_message && target_end_message){
      //batchEndMail(band,t200_state,low_product,film_end,(temp.current_no_of_case - temp.batch_start_no_of_case),target,`Production End signal without Low Product continue till 10 min ${moment().local().format("DD-MM-YYYYTHH:mm:ss")}`);
      target_end_timer_message = true;
      frequentGoodUpdate(machine, line_id, {
        bpm: bpm,
        mode: mode,
        machine_mode :'production_end',
        current_good_value: good_count,
        current_reject_value: reject_count,
        current_cycle_count: cycle_count,
        current_no_of_case:case_count,
      });
      return
   };
  //email with film end
  if(batch_end_message && film_end && !film_end_meassgae){
     film_end_meassgae = true;
     //batchEndMail(band,t200_state,low_product,film_end,(temp.current_no_of_case - temp.batch_start_no_of_case),target,`Film End signal receive after production end ${moment().local().format("DD-MM-YYYYTHH:mm:ss")}`);
  }
  //check for max bpm
  if (bpm > temp.bpm) {
    updateMaxBpm(
      line_id,
      d,
      shift,
      operator_name,
      batch,
      machine,
      bpm,
      () => {}
    );
  }
  //if plc value get reset
  if (good_count < reset_counter) {
    return;
  }

  frequentGoodUpdate(machine, line_id, {
    bpm: bpm,
    mode: mode,
    current_good_value: good_count,
    current_reject_value: reject_count,
    current_cycle_count: cycle_count,
    current_no_of_case:case_count,
  });
}
//add stop function
async function addstop(
  machine,
  not_used,
  changeover,
  pdt,
  updt,
  stop,
  blocked,
  waiting,
  alarm,
  manual_stop,
  execution,
  ready,
  shift,
  line_id,
  d,
  timestamp
) {
  // console.log(
  //   machine,
  //   not_used,
  //   changeover,
  //   pdt,
  //   updt,
  //   stop,
  //   blocked,
  //   waiting,
  //   alarm,
  //   manual_stop,
  //   ready,
  //   shift,
  //   line_id,
  //   d,
  //   timestamp
  // )
  var code;
  var current = preference([
    updt,
    changeover,
    not_used,
    pdt,
    non_zero(stop),
    manual_stop,
    blocked,
    non_zero(waiting),
    execution,
    ready,
  ]);
  //console.log(current);
  if (current == "fault") {
    code = `fault_${stop}`;
  } else if (current == "waiting" && typeof waiting == "number") {
    code = `waiting_${waiting}`;
  } else {
    code = current;
  }
  var condition = await getCondition(
    machine,
    line_id,
    d,
    shift,
    operator_name,
    batch
  );
  // console.log(stop)
  //if any alarm
  if (alarm > 0) {
    updateAlarm(machine, line_id, stop, alarm);
  } else {
    updateAlarmStatus(machine, line_id);
  }
  //console.log(machine_state_obj[machine])
  //if state change
  if (current != machine_state_obj[machine].condition) {
    //if poweroff b/w changeover
    var diff = moment(timestamp).diff(moment(condition.last_update), "seconds");
    if (
      machine_state_obj[machine].condition == "updt" &&
      global.changeSkuManualEntry
    ) {
      updatePowerOff(shift, diff, d);
    }
    machine_state_obj[machine].condition = current;
    //console.log(diff)
    updateStopData(
      line_id,
      d,
      shift,
      machine,
      condition.condition,
      condition.code,
      diff,
      (data) => {
        //console.log(data);
      }
    );
    postStop(machine, code, timestamp, line_id, shift, batch, fgex, d);
    updateCondition(machine, line_id, current, timestamp, code, (err, data) => {
      //console.log(data);
    });
  }
}
//get thingdata from thingworx
async function getThingData(thing) {
  const result = await new Promise((resolve, reject) => {
    request.get(
      {
        url: `http://103.205.66.170:8082/Thingworx/Things/${thing}/Properties/`,
        headers: header,
      },
      (error, response, data) => {
        if (error) {
          reject(error);
		  updateConnection("gateway_error", "cam_blister", line_id);
        } else {
          resolve(JSON.parse(data).rows[0]);
        }
      }
    );
  });

  return result;
}
//api data map

async function update_thing_data(thing) {
  try {
    const data = await getThingData(thing);
    thing_data_map[thing] = data;
  } catch (err) {
    console.log("error thing", thing, err);
    return;
  }
}

//check value with status
function non_zero(value) {
  var status;
  if (value == 0 || false) {
    status = false;
  } else {
    status = true;
  }
  return status;
}
// make a API call every 7 seconds
const interval = 7 * 1000;
setInterval(() => {
  things.forEach(async (thing, i) => {
    update_thing_data(thing);
    if (i + 1 == things.length) {
      processFunction();
    }
  });
}, interval);

// object filter
function object_filter(obj) {
  var keys = Object.keys(obj);
  var true_filter = keys.filter((key) => {
    return obj[key];
  });
  var result = 0;
  true_filter.forEach((element) => {
    if (Number(element) != 0) {
      result = Number(element);
    }
  });
  return result;
}

//give stop preference

var arr = [
  "updt",
  "changeover",
  "not_used",
  "pdt",
  "fault",
  "manual_stop",
  "blocked",
  "waiting",
  "executing",
  "ready",
];

function preference(array) {
  var return_value;
  var r_data = array.findIndex((data) => {
    return data == true;
  });
  if (r_data == -1) {
    return_value = "ready";
  } else {
    return_value = arr[r_data];
  }
  return return_value;
}

//do request
function doRequest(url) {
  return new Promise(function (resolve, reject) {
    request(url, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(JSON.parse(body));
      } else {
        reject(error);
      }
    });
  });
}
async function onPageRefresh() {
  var state = await Condition.find({});
  var getchangeoverstatus = await getIsNullTrue();
  if (getchangeoverstatus) {
    global.changeSkuManualEntry = true;
  }
  //console.log(state)
  state.forEach((element) => {
    machine_state_obj[element.machine] =
      machine_state_obj[element.machine] || {};
    machine_state_obj[element.machine]["condition"] = element.condition;
    // if (element.condition == "changeover" && element.machine == critical_machine) {
    //   global.changeSkuManualEntry = true;
    // }
  });
}

//function execute on page re
onPageRefresh();
app.listen(process.env.PORT, () => {
  console.log(`App is connected ${process.env.PORT}`);
});
