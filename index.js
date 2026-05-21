const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());








const JWKS = createRemoteJWKSet(
    new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`))

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
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {

        const JWKS = createRemoteJWKSet(
            new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
        );

        const { payload } = await jwtVerify(token, JWKS);

        req.user = payload;

    } catch (error) {

        console.error(error);

        return res.status(401).json({ message: 'Unauthorized' });
    }

    next();
};


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });

        const database = client.db('nooknestdb');
        const roomsCollection = database.collection('rooms');
        const bookNowCollection = database.collection('bookNow');
        const bookingsCollection = database.collection('bookings');

        app.post("/rooms", async (req, res) => {

            const roomData = req.body;

            const result = await roomsCollection.insertOne(roomData);

            res.send(result);
        });

        app.get("/myListings", async (req, res) => {

            const email = req.query.email;

            const query = {
                ownerEmail: email,
            };

            const result = await roomsCollection.find(query).toArray();

            res.send(result);
        });


        app.post('/rooms', async (req, res) => {

            const roomData = req.body;

            const result = await roomsCollection.insertOne(roomData);

            res.send(result);
        });

        app.delete('/rooms/:id', async (req, res) => {

            const id = req.params.id;

            const query = {
                _id: new ObjectId(id)
            };

            const result = await roomsCollection.deleteOne(query);

            res.send(result);
        });

        app.patch('/rooms/:id', async (req, res) => {

            const id = req.params.id;

            const updatedData = req.body;

            const query = {
                _id: new ObjectId(id)
            };

            const updateDoc = {
                $set: updatedData
            };

            const result = await roomsCollection.updateOne(query, updateDoc);

            res.send(result);
        });



        app.get("/rooms", async (req, res) => {
            console.log("QUERY:", req.query);

            const search = req.query.search?.trim().toLowerCase();

            let query = {};

            if (search) {
                query.name = {
                    $regex: search,
                    $options: "i",
                };
            }

            const rooms = await roomsCollection.find(query).toArray();
            res.send(rooms);
        });

        app.post('/bookings', async (req, res) => {

            const bookingData = req.body;

            const result = await bookingsCollection.insertOne({
                ...bookingData,
                status: 'confirmed',
                createdAt: new Date(),
            });

            res.send(result);
        });

        app.get('/bookings', async (req, res) => {

            const email = req.query.email;

            const query = {
                userEmail: email,
            };

            const result = await bookingsCollection.find(query).toArray();

            res.send(result);
        });

        app.patch('/bookings/:id', async (req, res) => {

            const id = req.params.id;

            const filter = {
                _id: new ObjectId(id),
            };

            const updatedDoc = {
                $set: {
                    status: 'cancelled',
                },
            };

            const result = await bookingsCollection.updateOne(filter, updatedDoc);

            res.send(result);
        });

        app.get('/rooms/:roomId', logger, verifyToken, async (req, res) => {
            const { roomId } = req.params;
            const query = { _id: new ObjectId(roomId) };
            const result = await roomsCollection.findOne(query);
            console.log(req.user);

            res.send(result);
            // console.log(roomId);

        });

        app.patch('booknow/:id', verifyToken, async (req, res) => {
            const { roomId } = req.params;
            const bookData = req.body;
            const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) })

            if (!room) {
                res.status(404).json({ massage: 'Room Not Found' })

                await roomsCollection.updateOne({ _id: new ObjectId(roomId) },
                    {
                        $inc: { bookNowCount: 1 },
                        $set: {
                            lastBookedAt: new Date(),
                        }
                    }

                )
            }

            const result = await bookNowCollection.insertOne({
                ...bookData,
                bookedAt: new Date(),

            })

            res.send(result)

        })

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


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});