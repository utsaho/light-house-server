const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());


const verifyJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: ' Unauthorized access 😒' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access 😢' });
        }
        req.decoded = decoded.email;
        next();
    })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nkmib.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const run = async () => {
    try {
        await client.connect();
        const userCollection = client.db('light-house').collection('users');
        const serviceCollection = client.db('light-house').collection('services');
        const orderCollection = client.db('light-house').collection('orders');
        const reviewCollection = client.db('light-house').collection('reviews');

        //* Store the user email to database and generating token
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            // const user = req.body;
            const filter = { email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {email}
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email }, process.env.SECRET_TOKEN, { expiresIn: '2d' });
            res.send({ result, token });
        });

        app.get('/services', async (req, res) => {
            res.send(await serviceCollection.find({}).toArray());
        });

        //* Getting a single service
        app.get('/service/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const result = await serviceCollection.findOne({ _id: ObjectId(id) });
            res.send(result);
        });

        //* Getting services expect single service
        //! use skip called from purchase page
        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const result = await serviceCollection.find({}) /* use skip and size */.toArray();
            res.send(result);
        });

        //* Store orders
        app.post('/postOrder', verifyJWT, async (req, res) => {
            const order = req.body;
            if (order?.email === req.decoded) {
                res.send(await orderCollection.insertOne(order));
                const result = await serviceCollection.findOne({ _id: ObjectId(order.productId) });
                const t = result.available - parseInt(order.quantity);
                const updateQuantity = {
                    $set: {
                        available: t
                    }
                }
                const temp = await serviceCollection.updateOne({ _id: ObjectId(order.productId) }, updateQuantity, { upsert: false });
            }
            else {
                res.send({});
            }
        });

        //* Getting orders
        app.get('/orders/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (email === req.decoded) {
                res.send(await orderCollection.find({ email }).toArray());
            }
            else {
                res.send({});
            }
        });

        //* Cancel a order
        app.post('/cancelOrder/:id', verifyJWT, async (req, res) => {
            const order = req.body;
            const id = req.params.id;
            if (req.decoded === order.email) {
                const result = await orderCollection.deleteOne({ _id: ObjectId(order._id) });
                res.send(result);
                const temp = await serviceCollection.findOne({ _id: ObjectId(id) });
                const available = temp.available + parseInt(order.quantity);
                const updateAvailable = {
                    $set: {
                        available
                    }
                }
                await serviceCollection.updateOne({ _id: ObjectId(id) }, updateAvailable, { upsert: false });
            }
            else {
                res.send({});
            }
        });

        //* Storing review
        app.post('/postReview', verifyJWT, async (req, res) => {
            const review = req.body;
            res.send(await reviewCollection.insertOne(review));
        });

        //* Getting review
        app.get('/reviews', async (req, res) => {
            res.send((await reviewCollection.find({}).limit(10).sort({ rating: -1 }).toArray()));
        });

        //* Update profile
        app.post('/updateProfile/:email', verifyJWT, async (req, res) => {
            const user = req.body;
            const email = req.params.email;
            const updateUser = {
                $set: {
                    user
                }
            }
            const result = await userCollection.updateOne({ email }, updateUser, { upsert: false });
            res.send(result);
        });

        //* Get profile
        app.get('/getProfile/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            res.send(await userCollection.findOne({ email }));
        });

        //* Make admin
        app.get('/makeAdmin/:email', verifyJWT, async(req, res)=>{
            const email = req.params.email;
            res.send(await userCollection.updateOne({email}, {$set:{role: 'admin'}}, {upsert: false}))
        });

        //* Checking for admin
        app.get('/isAdmin/:email', verifyJWT, async (req, res)=>{
            const email = req.params.email;
            const result = await userCollection.findOne({email});
            res.send({status: result?.role === 'admin'});
        });

    }
    finally { };
}

run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hey utsho, Your server is running');
});

app.listen(port, () => {
    console.log('Your port is running on: ', port);
});