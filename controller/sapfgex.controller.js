var express = require('express');
var router = express.Router();
var {SapFgex} = require('../model/sapfgex.model')
//post api for sap
router.post('/fgex',async(req,res)=>{
    var data = req.body;
    var fgex = req.body.fgex
    var check = await SapFgex.findOne({fgex:fgex})
    if (check) {
           var save = SapFgex.updateOne({fgex:fgex}, data, (err, data) => {
            if (err) {
                res.status(400).send(err.message)
            } else {
                res.status(200).send(data)
            }
        })
    } else {
        var raw = new SapFgex(req.body);
        try {
            var save = await raw.save();
            res.status(200).send({
                status:"Ok",
                res:"Data Successfully save in database"
            })
        } catch (error) {
            res.status(400).send({
                status:"error",
                res:error.message
            })
        }
    }  
});
module.exports = router;