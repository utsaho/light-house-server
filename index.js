const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nkmib.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const run = async () => {
    try {
        await client.connect();
        const userCollection = client.db('light-house').collection('users');

        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            // if (user && email) {
            //     console.log('user and email is ok');
            // }
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