var request = require('request');
var thing_url = "http://103.205.66.170:8082/Thingworx/Things/Cam_2/Properties/"

var writeTagInPlc = (tag,value)=>{
    obj = {}
    obj[tag] = value
    request.put(
        {
            url: `${thing_url}${tag}`,
            headers: {
                "content-type": "application/json",
                appKey: 'a6ad66f8-990f-4c1d-8366-86c143868b5f',
                Accept: "application/json",
            },
            body: JSON.stringify(obj),
        },
        (error, response, data) => {
            if (error) {
                console.log(error)
            } else {
                console.log(data)
            }
        }
    );
}

module.exports = {
    writeTagInPlc
}