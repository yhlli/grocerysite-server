const { Schema, model } = require('mongoose');


const GroceryListSchema = new Schema({
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    items: [{
        name: {
            type: String,
            required: true,
        },
        quantity: {
            type: Number,
            default: 1,
        },
        checked: {
            type: Boolean,
            default: false,
        },
    }],
}, {versionKey:false});

const GroceryListModel = model('GroceryList', GroceryListSchema);
module.exports = GroceryListModel;