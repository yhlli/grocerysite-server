const cron = require('node-cron');
const Post = require('./models/Post');
const User = require('./models/User');
const fetchNews = async()=>{
    const categories = ['technology', 'science', 'general'];
    const allNews = [];
    const user = await User.findOne({ username: 'newsbot' });
    if (!user){
        await User.create({
            username: 'newsbot',
            password: 'password',
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
const schedule = '0 0 9,17 * * *';
const job = cron.schedule(schedule, fetchNews);
job.start();
console.log('Cron job started for news ' + new Date());

module.exports = { fetchNews };