var express = require("express");
var router = express.Router();
var { Sap } = require("../model/sap.model");
var { Employee } = require("../model/employee.model");
//post api for sap
router.post("/batch", async (req, res) => {
  var authHeader = req.headers["auth-token"] || req.headers["Auth-Token"];
  if (!authHeader || authHeader != "sfw0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ8") {
    console.log("you are not authorize");
    // res.status(401).send("you are not authorize")
    res.status(401).json({
      status: "Unauthorized",
      message: "pls send a valid token",
    });
  } else {
    var data = req.body;
    var PONumber = req.body.PONumber;

    var check = await Sap.findOne({ PONumber: PONumber });
    if (
      !PONumber ||
      !data.LOTNumber ||
      !data.LOTSize ||
      !data.PlantCode ||
      !data.ProductCode ||
      !data.ProductDescription ||
      !data.UpdateTimestamp ||
      !data.PlantName
    ) {
      res.send("Required feild is missing");
    } else {
      var check = await Sap.findOne({ PONumber: PONumber });
      if (check) {
        var save = Sap.updateOne(
          { PONumber: PONumber },
          data,
          { runValidators: true },
          (err, data) => {
            if (err) {
              res.status(400).send(err.message);
            } else {
              res.status(200).json({
                status: "ok",
                message: "Data Successfully updated in database",
              });
            }
          }
        );
      } else {
        var raw = new Sap(req.body);
        try {
          var save = await raw.save();
          res.status(200).send({
            status: "Ok",
            res: "Data Successfully save in database",
          });
        } catch (error) {
          res.status(400).send({
            status: "error",
            res: error.message,
          });
        }
      }
    }
  }
});

router.post("/employee", async (req, res) => {
  var authHeader = req.headers["auth-token"] || req.headers["Auth-Token"];
  if (!authHeader || authHeader != "sfw0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ8") {
    // res.status(401).send("you are not authorize")
    res.status(401).json({
      status: "Unauthorized",
      message: "pls send a valid token",
    });
  } else {
    var data = req.body;
    var Empcode = req.body.empCode;
    //console.log(EmployeeId);
    var datasearch = await Employee.findOne({ empCode: Empcode });
    //console.log(datasearch);
    if (datasearch) {
      var save = await Employee.update(
        { empCode: Empcode },
        data,
        (err, data) => {
          if (err) {
            res.status(400).send(err.message);
          } else {
            res.status(200).send(data);
          }
        }
      );
    } else {
      var raw = new Employee(req.body);
      try {
        var save = await raw.save();
        res.status(200).json({
          status: "ok",
          message: "Data Successfully save in database",
        });
      } catch (error) {
        res.status(400).send(error.message);
      }
    }
  }
});

router.get("/employee", async (req, res) => {
  var token = req.query.token;
  if (token == "sfw0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ8") {
    var data = await Employee.find({});
    res.send(data);
  } else {
    res.send("you are not authorized to access data");
  }
});

// router.get('/:token',async(req,res)=>{
//     req.params['token'] == "sfw0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ8"
//     //console.log( req.params['token'] == "sfw0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ8");
//     if( req.params['token'] == "sfw0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ8"){
//         var data = await Sap.find({})
//         res.send(data)
//     }
//     else{
//         res.send("you are not authorized to access data")
//     }
// });

router.get("/", async (req, res) => {
  var token = req.query.token;
  if (token == "sfw0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ8") {
    var data = await Sap.aggregate([
      {
        $match: {
          current_status: "unassign",
          HalbCode: {
            $ne: null,
          },
        },
      },
      {
        $lookup: {
          from: "fgexes",
          let: { halb_code: "$HalbCode", fgex: "$ProductCode" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ["$halb_code", "$$halb_code"],
                    },
                    {
                      $eq: ["$fgex", "$$fgex"],
                    },
                  ],
                },
              },
            },
          ],
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
        $project: {
          isUsed: 1,
          postApiHitFrom: 1,
          PONumber: 1,
          LOTNumber: 1,
          HalbCode: 1,
          LOTSize: 1,
          PlantCode: 1,
          ProductCode: 1,
          ProductDescription: 1,
          status:"$current_status",
          UpdateTimestamp: 1,
          createdAt: 1,
          updatedAt: 1,
          ratedSpeed: {
            $ifNull: ["$fgex.rated_speed", null],
          },
          layout: {
            $ifNull: ["$fgex.layout_no", null],
          },
          ProductName: {
            $ifNull: ["$fgex.product_name", null],
          },
        },
      },
    ]);
    res.send(data);
  } else {
    res.send("you are not authorized to access data");
  }
});

router.get("/single_po_data", async (req, res) => {
  var token = req.query.token;
  var pono = req.query.poNo;
  if (token == "sfw0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ8") {
    var data = await Sap.findOne({ PONumber: pono });
    if (data) {
      res.send(data);
    } else {
      res.send("POnumber not present or recheck enter POnumber");
    }
  } else {
    res.send("you are not authorized to access data");
  }
});

module.exports = router;
