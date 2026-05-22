const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);

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
    next();
};

const verifyToken = async (req, res, next) => {
    const { authorization } = req.headers;
    const token = authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
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
        await client.connect();

        const database = client.db('nooknestdb');
        const roomsCollection = database.collection('rooms');
        const bookNowCollection = database.collection('bookNow');
        const bookingsCollection = database.collection('bookings');

        // GET ROOMS (single cleaned version)
        app.get("/rooms", async (req, res) => {

            const { search, min, max, amenities } = req.query;

            let query = {};

            // 1️⃣ SEARCH
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { description: { $regex: search, $options: "i" } },
                    { floor: { $regex: search, $options: "i" } }
                ];
            }

            // 2️⃣ PRICE RANGE
            if (min || max) {
                query.price = {
                    ...(min && { $gte: Number(min) }),
                    ...(max && { $lte: Number(max) })
                };
            }

            // 3️⃣ MULTI AMENITIES (IMPORTANT)
            if (amenities) {
                const list = amenities.split(",");

                query.amenities = {
                    $in: list
                };
            }

            const rooms = await roomsCollection.find(query).toArray();
            res.send(rooms);
        });

        // POST ROOM (single only)
        app.post("/rooms", async (req, res) => {
            const roomData = req.body;
            const result = await roomsCollection.insertOne(roomData);
            res.send(result);
        });

        // MY LISTINGS
        app.get("/myListings", verifyToken, async (req, res) => {
            const email = req.query.email;

            const query = {
                ownerEmail: email,
            };

            const result = await roomsCollection.find(query).toArray();
            res.send(result);
        });

        // DELETE ROOM
        app.delete('/rooms/:id', async (req, res) => {
            const id = req.params.id;

            const query = {
                _id: new ObjectId(id)
            };

            const result = await roomsCollection.deleteOne(query);
            res.send(result);
        });

        // UPDATE ROOM
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

        // BOOKINGS CREATE
        app.post('/bookings', async (req, res) => {
            const bookingData = req.body;

            const result = await bookingsCollection.insertOne({
                ...bookingData,
                status: 'confirmed',
                createdAt: new Date(),
            });

            res.send(result);
        });

        // GET BOOKINGS
        app.get('/bookings', async (req, res) => {
            const email = req.query.email;

            const query = {
                userEmail: email,
            };

            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        });

        // CANCEL BOOKING
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

        // SINGLE ROOM (protected)
        app.get('/rooms/:roomId', logger, verifyToken, async (req, res) => {
            const { roomId } = req.params;

            const query = { _id: new ObjectId(roomId) };

            const result = await roomsCollection.findOne(query);

            console.log(req.user);

            res.send(result);
        });

        // BOOK NOW (ONLY minimal fix: route param issue corrected)
        app.patch('/booknow/:id', verifyToken, async (req, res) => {
            const { id } = req.params;
            const bookData = req.body;

            const room = await roomsCollection.findOne({
                _id: new ObjectId(id)
            });

            if (!room) {
                return res.status(404).json({ message: 'Room Not Found' });
            }

            await roomsCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $inc: { bookNowCount: 1 },
                    $set: {
                        lastBookedAt: new Date(),
                    }
                }
            );

            const result = await bookNowCollection.insertOne({
                ...bookData,
                bookedAt: new Date(),
            });

            res.send(result);
        });

        // FEATURED
        app.get('/featured', async (req, res) => {
            const cursor = roomsCollection.find().limit(6);
            const featuredRooms = await cursor.toArray();

            res.send(featuredRooms);
        });

        console.log("Connected to MongoDB successfully!");

    } finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});