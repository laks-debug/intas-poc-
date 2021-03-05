var mongoose = require('mongoose');

var histroySchema = new mongoose.Schema({
    timestamp:{
        type:Date
    },
    batch_wise:{
        type:Object,
    },
    shift_wise:{
        type:Object
    }
});

var History = mongoose.model('history',histroySchema);
var addHistory = async (data)=>{
    var history = new History(data);
    var save = await history.save();
    console.log(save)

}

module.exports.History = History;
module.exports.addHistory = addHistory;