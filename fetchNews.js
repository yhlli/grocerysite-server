const cron = require('node-cron');
const Post = require('./models/Post');
const User = require('./models/User');
const e = require('cors');
const fetchNews = async()=>{
    const categories = ['technology', 'science', 'general'];
    const allNews = [];
    const user = await User.findOne({ username: 'newsbot' });
    if (!user){
        await User.create({
            username: 'newsbot',
            password: 'password',
            email: 'dummy@gmail.com',
            verified: true,
        });
    }
    for (const category of categories) {
        const url = 'https://newsapi.org/v2/top-headlines?' +
            'country=us&' +
            `category=${category}&` +
            'pageSize=5&' +
            `apiKey=${process.env.NEWS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'ok') {
            for (const article of data.articles) {
                if (article.content !== null) {
                    allNews.push(article);
                }
            }
        } else {
            console.error(`Error fetching ${category} category news `, data.message);
        }
    }
    for (const news of allNews){
        const existingPost = await Post.findOne({ title: news.title });
        if (!existingPost){
            let publishedAt;
            if (news.publishedAt){
                publishedAt = new Date(news.publishedAt);
            } else if (news.date) {
                publishedAt = new Date(news.date);
            } else {
                publishedAt = new Date();
            }
            await Post.create({
                title: news.title,
                summary: news.description,
                content: news.content,
                cover: news.urlToImage,
                author: user._id,
                uname: news.author ?? news.source.name,
                views: 0,
                newsBot: true,
                pageUrl: news.url,
                createdAt: publishedAt,
            });
        }
    }
    const postCount = await Post.countDocuments();
    const limit = 300; //how many posts to allow total
    if (postCount > limit){
        const numberToDelete = postCount - limit;
        const postsToDelete = await Post.find({ newsBot: true })
            .sort({ createdAt: 1 })
            .limit(numberToDelete);
        for (const post of postsToDelete){
            await post.deleteOne();
        }
    }
}
const deleteAllNewsBotPosts = async () => {
    try {
        const deleteResult = await Post.deleteMany({ newsBot: true });
        console.log(`Deleted ${deleteResult.deletedCount} newsBot posts.`);
    } catch (error) {
        console.error("Error deleting newsBot posts:", error);
    }
};
const schedule = '0 0 14,22 * * *';
const job = cron.schedule(schedule, fetchNews);
//deleteAllNewsBotPosts();
job.start();
console.log('Cron job started for news ' + new Date());

module.exports = { fetchNews };