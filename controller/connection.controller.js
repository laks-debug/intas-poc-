var express = require('express');
var router = express.Router();
var { getConnection } = require('../model/connection.model');
var moment = require('moment');

router.get('/' , async (req,res)=>{
	var connection = await getConnection('cam_blister');
	var data = [
	{
		machine_name:"cam_blister",
		status : connection.status,
		current_timestamp:moment().local().format(),
	}
	]
	res.send(data)
	
});
module.exports = router;