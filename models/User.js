const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const Post = require('./Post');

const UserSchema = Schema({
    username: { type: String, required: true, min: 4, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    verified: { type: Boolean, default: false },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    favoritePosts: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: Post,
        default: [],
    },
    highscore: { type: Number, required: false, default: 1500, },
    money: { type: Number, required: false, default: 1500, },
},{
    timestamps: true,
});

const UserModel = model('User', UserSchema);

module.exports = UserModel;