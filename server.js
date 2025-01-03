require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');
const Bio = require('./models/Bio');
const GroceryList = require('./models/GroceryList');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const salt = bcrypt.genSaltSync(10);
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');
const https = require('https');
const corsOptions = {
    origin: (origin, callback) => {
        if (["https://luke.lilinart.com", "http://luke.lilinart.com", "https://grocerysite-client.onrender.com"].includes(origin) || !origin) {
        //if (["http://localhost:5173"].includes(origin) || !origin) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

/* try {
    mongoose.connect(process.env.DATABASE_URI).then(()=> {
        console.log('Connected to mongoose');
        const privateKey = fs.readFileSync('/etc/letsencrypt/live/luke.lilinart.com/privkey.pem', 'utf8');
        const certificate = fs.readFileSync('/etc/letsencrypt/live/luke.lilinart.com/fullchain.pem', 'utf8');
        const credentials = {
            key: privateKey,
            cert: certificate
        };

        const httpsServer = https.createServer(credentials, app);
        httpsServer.listen(8080, () => {
            console.log('HTTPS server is listening on port 8080');
        });
    });
    
} catch (error) {
    console.log(error);
} */

try {
    mongoose.connect(process.env.DATABASE_URI);
    console.log('Connected to mongoose');
} catch (error) {
    console.log(error);
}
app.listen(8080, ()=>{
    console.log("Server started on port 8080");
});


const authenticate = async (req,res,next)=>{
    const accessToken = req.header('Authorization')?.split(' ')[1];
    const refreshToken = req.header('x-refresh-token');
    try {
        if (!accessToken && !refreshToken) {
            return res.status(401).send('Access Denied. No token provided.');
        }
        const info = await jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, {});
        req.infoId = info.id;
        req.infoUsername = info.username;
    } catch (err) {
        if (!refreshToken) {
            return res.status(401).sent('Access Denied. No refresh token provided.');
        }
        try {
            const refreshInfo = await jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, {});
            req.infoId = refreshInfo.id;
            req.infoUsername = refreshInfo.username;
            const accessToken = jwt.sign({ refreshInfo, id: refreshInfo._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.setHeader('Authorization', `Bearer ${accessToken}`);
        } catch (err) {
            return res.status(400).send('Invalid Refresh Token.')
        }
    }
    next();
}

app.get('/profile', authenticate, async (req,res)=>{
    if(req.infoId){
        const info = { username: req.infoUsername, id: req.infoId };
        res.json(info);
    } else{
        res.json(null);
    }
})

app.post('/register', async (req,res)=>{
    const {username,password} = req.body;
    try {
        const userDoc = await User.create({
            username,
            password: bcrypt.hashSync(password, salt)
        });
        res.json({userDoc});
    } catch (e) {
        console.log(e);
        res.status(400).json(e);
    }
})

app.post('/login', async (req,res)=>{
    const {username,password} = req.body;
    const userDoc = await User.findOne({username});
    if (userDoc && bcrypt.compareSync(password, userDoc.password)){
        const accessToken = jwt.sign({ username,id: userDoc._id }, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
        const refreshToken = jwt.sign({ username, id: userDoc._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' });
        res.json({ accessToken, refreshToken, id:userDoc._id, username });
    } else{
        res.status(401).json({ message: 'Invalid credentials' });
    }
})

app.post('/post', uploadMiddleware.single('file'), authenticate, async (req, res) => {
    var path;
    var originalname;
    var parts;
    var ext;
    if (req.file !== undefined) {
        path = req.file.path;
        originalname = req.file.originalname;
        parts = originalname.split('.');
        ext = parts[parts.length - 1];
    } else {
        path = 'uploads\\default';
        ext = 'jpg';
    }
    const newPath = path + '.' + ext;
    if (req.file !== undefined) fs.renameSync(path, newPath);
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: req.infoId,
        uname: req.infoUsername,
        views: 0,
    });
    res.json(postDoc);
});

app.put('/post', uploadMiddleware.single('file'), authenticate, async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(req.infoId);
    if (!isAuthor) {
        return res.status(400).json('You are not the author');
    }
    await postDoc.updateOne({
        title,
        summary,
        content,
        cover: newPath ? newPath : postDoc.cover,
    });
    res.json(postDoc);
});

app.get('/post', async (req, res) => {
    const page = parseInt(req.query.page);
    const sortBy = parseInt(req.query.sort);
    const sortCriteria = {
        1: { createdAt: -1 },
        2: { createdAt: 1 },
        3: { views: -1, createdAt: -1 },
        4: { views: 1, createdAt: -1 },
    };
    const offset = 20;
    const Posts = await Post.find()
        .populate('author', ['username'])
        .sort(sortCriteria[sortBy])
        .limit(offset)
        .skip((page - 1) * offset);

    Posts.forEach(function (postItem) {
        var co = postItem.cover;
        if (!fs.existsSync(co)) postItem.cover = 'uploads\\default.jpg';
    })
    res.json({
        data: Posts,
        totalCount: await Post.countDocuments(),
    }
    );
});

app.get('/post/:id', async (req, res) => {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    const viewCount = postDoc.views;
    await postDoc.updateOne({
        views: viewCount + 1,
    });
    if (!fs.existsSync(postDoc.cover)) postDoc.cover = 'uploads\\default.jpg';
    const userId = req.query.user;
    let favPosts = [];
    if (userId) {
        const user = await User.findById(userId).populate('favoritePosts');
        favPosts = user.favoritePosts;
    }
    res.json({
        data: postDoc,
        favPosts: favPosts,
    });
});

app.delete('/post/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    await Comment.deleteMany({ postId: id });
    await Post.deleteOne(Post.findById(id));
    res.json('ok');
});

app.post('/comment/:id', uploadMiddleware.single('file'), authenticate, async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    const commentDoc = await Comment.create({
        postId: id,
        content: comment,
        author: req.infoId,
    })
    res.json(commentDoc);
});

app.get('/comment/:id', async (req, res) => {
    const { id } = req.params;
    const commentDoc = await Comment.find({ postId: id }).populate('author', ['username']);
    res.json(commentDoc);
});

app.delete('/comment/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    await Comment.deleteOne(Comment.findById(id));
    res.json('ok');
});

app.get('/user/:id', async (req, res) => {
    const { id } = req.params;
    const bioDoc = await Bio.find({ postId: id });
    res.json(bioDoc);
});

app.post('/user/editbio/:id', uploadMiddleware.single('file'), authenticate, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    await Bio.deleteMany({ postId: id });
    const bioDoc = await Bio.create({
        postId: id,
        content: content,
        author: req.infoId,
    })
    res.json(bioDoc);
});

app.get('/user/post/:id', async (req, res) => {
    const page = parseInt(req.query.page);
    const offset = 20;
    const { id } = req.params;
    const sortBy = parseInt(req.query.sort);
    const fav = req.query.fav === 'true';
    const sortCriteria = {
        1: { createdAt: -1 },
        2: { createdAt: 1 },
        3: { views: -1, createdAt: -1 },
        4: { views: 1, createdAt: -1 },
    };
    if (fav) {
        const [user] = await User.find({ username: id }).populate('favoritePosts');
        const favPostIds = user.favoritePosts?.map(post => post._id);
        const favPosts = await Post.find({ _id: { $in: favPostIds } })
            .populate('author', ['username'])
            .sort(sortCriteria[sortBy])
            .limit(offset)
            .skip((page - 1) * offset);
        favPosts.forEach(function (postItem) {
            var co = postItem.cover;
            if (!fs.existsSync(co)) postItem.cover = 'uploads\\default.jpg';
        })
        res.json({
            data: favPosts,
            totalCount: await Post.countDocuments(),
        }
        );
    } else {
        const userPosts = await Post.find({ uname: id })
            .populate('author', ['username'])
            .sort(sortCriteria[sortBy])
            .limit(offset)
            .skip((page - 1) * offset);
        userPosts.forEach(function (postItem) {
            var co = postItem.cover;
            if (!fs.existsSync(co)) postItem.cover = 'uploads\\default.jpg';
        })
        res.json({
            data: userPosts,
            totalCount: await Post.countDocuments(),
        }
        );
    }
});

app.post('/post/favorite/:id', authenticate, async (req, res) => {
    const userId = req.query.user;
    const { id } = req.params;
    const user = await User.findById(userId);
    user.favoritePosts.push(id);
    await user.save();
    res.json('ok');
});

app.delete('/post/favorite/:id', authenticate, async (req, res) => {
    const userId = req.query.user;
    const { id } = req.params;
    const user = await User.findById(userId);
    user.favoritePosts.pull(id);
    await user.save();
    res.json('ok');
});

const apiKey = '6655f7278841063bec5ea609d28dd7c9';

app.get('/weather', async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ error: 'Missing latitude or longitude parameters' });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;

    https.get(url, (response) => {
        let weatherData = '';
        response.on('data', (chunk) => {
            weatherData += chunk;
        });

        response.on('end', () => {
            try {
                const parsedData = JSON.parse(weatherData);
                res.json(parsedData); // Send the parsed weather data
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Failed to parse weather data' });
            }
        });

        response.on('error', (error) => {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch weather data' });
        });
    });
});

app.get('/user/:id/money', authenticate, async (req, res) => {
    const { id } = req.params;
    const user = await User.findOne({ username: id });
    const cash = user.money;
    res.json(cash);
});

app.post('/user/:id/money', authenticate, async (req, res) => {
    const { id } = req.params;
    const money = parseInt(req.query.money);
    const user = await User.findOne({ username: id });
    await user.updateOne({ $set: { money: money } })
    res.json('ok');
});

app.get('/user/:id/highscore', authenticate, async (req, res) => {
    const { id } = req.params;
    const user = await User.findOne({ username: id });
    res.json(user.highscore);
});

app.post('/user/:id/highscore', authenticate, async (req, res) => {
    const { id } = req.params;
    const money = parseInt(req.query.money);
    const user = await User.findOne({ username: id });
    await user.updateOne({ $set: { highscore: money } });
    res.json('ok');
});

app.delete('/user/:id/delete', authenticate, async (req, res) => {
    const { id } = req.params;
    const userid = await User.findOne({ username: id });
    await Comment.deleteMany({ author: userid._id });
    await Post.deleteMany({ author: userid._id });
    await User.deleteOne({ _id: userid._id });
    await Bio.deleteOne({ author: userid._id });
    await GroceryList.deleteOne({ author: userid._id });
    res.json('ok');
});

app.get('/:id/grocerylist', authenticate, async (req, res) => {
    const { id } = req.params;
    const groceries = await GroceryList.findOne({ author: id }).populate("items");
    if (groceries === null) {
        await GroceryList.create({
            author: req.infoId,
            name: '',
            quantity: '',
        })
        res.json("ok");
    } else {
        res.json(groceries.items);
    }
});

app.post('/:id/grocerylist', uploadMiddleware.single('file'), authenticate, async (req, res) => {
    const { id } = req.params;
    const { groceryItem, groceryQuantity } = req.body;
    const gList = await GroceryList.findOne({ author: id });
    const existsItem = gList.items.find(item => item.name === groceryItem);
    if (existsItem) {
        existsItem.quantity = existsItem.quantity + Number(groceryQuantity);
    } else {
        await gList.items.push({ name: groceryItem, quantity: groceryQuantity });
    }
    await gList.save();
    res.json({ name: groceryItem, quantity: groceryQuantity });
});

app.delete('/:id/grocerylist', authenticate, async (req, res) => {
    const { id } = req.params;
    const { item } = req.query;
    const gList = await GroceryList.findOne({ author: id }).populate("items");
    await gList.items.pull(item);
    await gList.save();
    res.json('ok');
});

app.put('/:id/grocerylist', authenticate, async (req, res) => {
    const { id } = req.params;
    const groceryCopy = req.body;
    await GroceryList.findOneAndUpdate({ author: id }, { items: groceryCopy });
    res.json('ok');
});

app.put('/:id/grocerylistquantity', authenticate, async (req, res) => {
    const { id } = req.params;
    const { num, name } = req.query;
    const gList = await GroceryList.findOne({ author: id });
    const index = gList.items.findIndex(item => item.name === name);
    if (index === -1) {
        return res.status(404).json({ message: 'Item not found in the list' });
    }
    gList.items[index].quantity += Number(num);
    await gList.save();
    res.json('ok');
});

app.get('/:id/grocerylistcheck', authenticate, async(req, res)=>{
    const { id } = req.params;
    const { name } = req.query;
    const gList = await GroceryList.findOne({ author: id });
    const index = gList.items.findIndex(item => item.name === name);
    if (index === -1) {
        return res.status(404).json({ message: 'Item not found in the list' });
    }
    const response = gList.items[index].checked;
    res.json(response);
});

app.put('/:id/grocerylistcheck', authenticate, async(req, res)=>{
    const { id } = req.params;
    const { name } = req.query;
    const boo = req.body.isChecked;
    const gList = await GroceryList.findOne({ author: id });
    const index = gList.items.findIndex(item => item.name === name);
    if (index === -1) {
        return res.status(404).json({ message: 'Item not found in the list' });
    }
    gList.items[index].checked = boo;
    await gList.save();
    res.json('ok');
});