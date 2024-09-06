const { Schema, model } = require('mongoose');

const BioSchema = new Schema({
    postId: String,
    content: String,
    author:{type:Schema.Types.ObjectId, ref: 'User'}
},{
    timestamps: false,
});

const BioModel = model('Bio', BioSchema);
module.exports = BioModel;