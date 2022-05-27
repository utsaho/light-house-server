const { MongoClient, ServerApiVersion } = require('mongodb');
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

        //* Store the user email to database and generating token
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    user,
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email }, process.env.SECRET_TOKEN, { expiresIn: '2d' });
            res.send({ result, token });
        });

        app.get('/services', async (req, res) => {
            res.send(await serviceCollection.find({}).toArray());
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