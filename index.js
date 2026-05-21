const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());





app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});




const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const logger = (req, res, next) => {

    console.log(`${req.method} || ${req.url}`);

    next()
}


const verifyToken = async (req, res, next) => {
    const { authorization } = req.headers;

    console.log(authorization);

    // console.log(req.headers, 'from verify token');

    next()

}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });

        const database = client.db('nooknestdb');
        const roomsCollection = database.collection('rooms');


        app.get('/rooms', async (req, res) => {
            const cursor = roomsCollection.find({});
            const rooms = await cursor.toArray();
            console.log(rooms);

            res.send(rooms);
        });
        app.get('/rooms/:roomId', logger, verifyToken, async (req, res) => {
            const { roomId } = req.params;
            const query = { _id: new ObjectId(roomId) };
            const result = await roomsCollection.findOne(query);

            res.send(result);
            // console.log(roomId);

        });

        app.get('/featured', async (req, res) => {
            const cursor = roomsCollection.find().limit(6);
            const featuredRooms = await cursor.toArray();



            res.send(featuredRooms);
        });











        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
