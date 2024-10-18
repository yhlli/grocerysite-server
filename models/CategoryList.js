const mongoose = require('mongoose');
const { Schema, model } = require('mongoose');
const GroceryList = require('./GroceryList');


const CategoryListSchema = new Schema({
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    name: {
        type: String,
    },
    items: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: GroceryList,
        default: [],
    },
}, { versionKey: false });

const CategoryListModel = model('CategoryList', CategoryListSchema);
module.exports = CategoryListModel;