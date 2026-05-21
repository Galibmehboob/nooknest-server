const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();
const cors = require('cors');
const { createRemoteJWKSet } = require('jose-cjs');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());





app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`))

console.log(JWKS);



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


    const token = authorization?.split(" ")[1];




    if (!token) {
        return res.status(401).json({ massage: 'Unauthorize' })
    }

    try {
        const JWKS = createRemoteJWKSet(
            new URL('http://localhost:3000/api/auth/jwks')
        )
        const { payload } = await jwtVerify(token, JWKS);
        // console.log(payload);
        req.user = payload;
        console.log(req.user);


        // return payload
    } catch (error) {
        console.error('Token validation failed:', error)
        // throw error
        return res.status(401).json({ massage: 'Unauthorize' })

    }

    // console.log(token);

    // console.log(authorization);

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
            console.log(req.user);

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
