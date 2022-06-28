const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const stripe = require('stripe')(process.env.STRIPE_SK);


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
        const paymentCollection = client.db('light-house').collection('payments');
        const summeryCollection = client.db('light-house').collection('summery');
        const qnaCollection = client.db('light-house').collection('QNA');

        //* Store the user email to database and generating token
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email };
            const options = { upsert: true };
            const updateDoc = {
                $set: { email }
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email }, process.env.SECRET_TOKEN, { expiresIn: '2d' });
            res.send({ result, token });
        });

        //* Getting all services
        app.get('/services', async (req, res) => {
            res.send(await serviceCollection.find({}).toArray());
        });

        //* Post a product
        app.post('/newProduct/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const product = req.body;
            if ((req.decoded === email) && product?.img) {
                res.send(await serviceCollection.insertOne({ ...product }));
            }
            else {
                res.send({});
            }
        });

        //* Getting a single service
        app.get('/service/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            if (id.split('-')[1] === 'name') {
                const name = id.split('-')[0];
                res.send(await serviceCollection.findOne({ name: `${name}` }));
            }
            else res.send(await serviceCollection.findOne({ _id: ObjectId(id) }));
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
            console.log(req.decoded);
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
                res.send(await orderCollection.find({ email }).sort({ 'status': -1 }).toArray());
            }
            else {
                res.send({});
            }
        });

        //* Cancel a order
        app.post('/cancelOrder/:id', verifyJWT, async (req, res) => {
            const order = req.body;
            const id = req.params.id;
            const result = await userCollection.findOne({ email: req.decoded });
            if ((req.decoded === order.email) || (result?.role === 'admin')) {
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

        //* Delete a product
        app.post('/product/:id', verifyJWT, async (req, res) => {
            const order = req.body;
            const id = req.params.id;
            const result = await userCollection.findOne({ email: req.decoded });
            if (result?.role === 'admin') {
                const result = await serviceCollection.deleteOne({ _id: ObjectId(order._id) });
                res.send(result);
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
            res.send(await reviewCollection.find({}).limit(100).sort({ rating: -1 }).toArray());
        });

        //* Update profile
        app.post('/updateProfile/:email', verifyJWT, async (req, res) => {
            const user = req.body;
            const email = req.params.email;
            if (email === req.decoded) {
                if (user?.imageStorageKey) {
                    const key = user?.imageStorageKey;
                    await userCollection.updateOne({ email }, { $set: { imageStorageKey: key } }, { upsert: false });
                    delete user.imageStorageKey;
                }
                const updateUser = {
                    $set: {
                        user
                    }
                }
                res.send(await userCollection.updateOne({ email }, updateUser, { upsert: false }));
            }
            else res.send({});
        });

        //* Get profile
        app.get('/getProfile/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            res.send(await userCollection.findOne({ email }));
        });

        //* Make admin
        app.get('/makeAdmin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            res.send(await userCollection.updateOne({ email }, { $set: { role: 'admin' } }, { upsert: false }))
        });

        //* Checking for admin
        app.get('/isAdmin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email });
            res.send({ status: result?.role === 'admin' });
        });

        //* Getting all orders
        //! use skip and pagination for better performance
        app.get('/allOrders/:category', verifyJWT, async (req, res) => {
            const category = req.params.category;
            if (category !== 'all') res.send(await orderCollection.find({ 'status': `${category}` }).toArray());
            else res.send(await orderCollection.find({}).toArray());
        });

        //* Getting single order
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            res.send(await orderCollection.findOne({ _id: ObjectId(id) }));
        });

        //* Order shipped
        app.put('/shipped/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const result = await orderCollection.findOne({ _id: ObjectId(id) });
            if (result?.status === 'paid') {
                res.send(await orderCollection.updateOne({ _id: ObjectId(id) }, { $set: { status: 'shipped' } }, { upsert: false }));
            }
        });

        //* Payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({ clientSecret: paymentIntent.client_secret });
        });

        //* update status to paid
        app.patch('/paid/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const product = req.body;
            const paymentDoc = {
                email: product.email,
                orderId: product._id,
                productId: product.productId,
                time: `${new Date().toLocaleTimeString()}, ${new Date().toLocaleDateString()}`,
                transactionId: product.transactionId,
                phone: product.phone,
                price: product.price
            }

            const presentRevenue = await summeryCollection.find({}).toArray();
            if (presentRevenue.length) {
                const tempRevenue = presentRevenue[0].revenue;
                // const id = presentRevenue[0]._id.toJSON();
                await summeryCollection.updateOne({ _id: ObjectId(presentRevenue[0]._id.toJSON()) }, { $set: { revenue: presentRevenue[0].revenue + product.price } });
            }
            else await summeryCollection.insertOne({ revenue: product.price });

            await paymentCollection.insertOne(paymentDoc);
            res.send(await orderCollection.updateOne({ _id: ObjectId(product._id) }, { $set: { status: 'paid', transactionId: product.transactionId } }));
        });

        //* Getting image storage key for admin
        app.get('/imageStorageKey/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded === email) {
                res.send(await userCollection.findOne({ email }));
            }
            else {
                res.send({});
            }
        });

        //* Sending all users
        app.get('/allUsers/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (email === req.decoded) {
                res.send(await userCollection.find({}).toArray());
            }
            else res.send({});
        });

        //* Admin status change
        app.put('/adminSetting/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            if (email === req.decoded) {
                if (!user?.admin) {
                    res.send(await userCollection.updateOne({ email: user?.email }, { $set: { role: 'admin', imageStorageKey: user?.imageStorageKey } }, { upsert: true }));
                }
                else {
                    res.send(await userCollection.updateOne({ email: user?.email }, { $set: { role: 'user', imageStorageKey: null } }, { upsert: true }));
                }
            }
            else res.send({});
        });

        //* Business Summery
        app.get('/summery', async (req, res) => {
            const customers = await userCollection.estimatedDocumentCount();
            const reviews = await reviewCollection.estimatedDocumentCount();
            const tools = await serviceCollection.estimatedDocumentCount();
            const revenueArr = await summeryCollection.find({}).toArray();
            const revenue = revenueArr[0].revenue;
            res.send({ customers, tools, revenue, reviews });
        });

        //* getting QNA
        app.get('/qna', async (req, res) => {
            res.send(await qnaCollection.find({}).toArray());
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