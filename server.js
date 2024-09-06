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
const corsOptions = {
    origin: (origin, callback) => {
        //if (["http://localhost:5173"].includes(origin) || !origin) {
        if (["https://grocerysite-client.onrender.com"].includes(origin) || !origin) {
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
    const user = await User.findOne({username});
    if (user && bcrypt.compareSync(password, user.password)){
        const accessToken = jwt.sign({ username,id: user._id }, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
        const refreshToken = jwt.sign({ username, id: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' });
        res.json({ accessToken, refreshToken });
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