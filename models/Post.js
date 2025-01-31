const mongoose = require('mongoose');
const {Schema,model} = mongoose;

const PostSchema = new Schema({
    title:String,
    summary:String,
    content:String,
    cover:String,
    author:{type:Schema.Types.ObjectId, ref:'User'},
    uname:String,
    views:Number,
    newsBot:{type: Boolean, default: false },
    pageUrl:{type: String, default: ''},
}, {
    timestamps: true,
});

const PostModel = model('Post', PostSchema);

/* async function deleteNewsBotPosts() {
    try {
        const result = await PostModel.deleteMany({ newsBot: true });
        console.log(`Deleted ${result.deletedCount} posts with newsBot true.`);
    } catch (error) {
        console.error('Error deleting posts:', error);
    }
}

deleteNewsBotPosts(); */

module.exports = PostModel;