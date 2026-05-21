const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const {
    MongoClient,
    ServerApiVersion,
    ObjectId
} = require('mongodb');

const {
    createRemoteJWKSet,
    jwtVerify
} = require('jose-cjs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;



// MIDDLEWARES

app.use(cors({
    origin: ['https://nooknest.vercel.app/'],
    credentials: true
}));

app.use(express.json());

app.use(cookieParser());





// BETTER AUTH JWKS

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);




// MONGODB

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});




// LOGGER MIDDLEWARE

const logger = (req, res, next) => {

    console.log(`${req.method} || ${req.url}`);

    next();
};




// VERIFY TOKEN MIDDLEWARE

const verifyToken = async (req, res, next) => {

    const token = req.cookies.token;

    if (!token) {

        return res.status(401).json({
            message: 'Unauthorized Access'
        });
    }

    try {

        const { payload } = await jwtVerify(token, JWKS);

        req.user = payload;

        next();

    } catch (error) {

        console.error(error);

        return res.status(401).json({
            message: 'Invalid or Expired Token'
        });
    }
};




// MAIN FUNCTION

async function run() {

    try {

        await client.connect();

        const database = client.db('nooknestdb');

        const roomsCollection = database.collection('rooms');

        const bookingsCollection = database.collection('bookings');





        // GET ALL ROOMS WITH SEARCH & FILTER

        app.get("/rooms", async (req, res) => {

            console.log("QUERY:", req.query);

            const search = req.query.search?.trim();

            const amenities = req.query.amenities;

            const minPrice = req.query.minPrice;

            const maxPrice = req.query.maxPrice;

            let query = {};



            // SEARCH BY ROOM NAME

            if (search) {

                query.name = {
                    $regex: search,
                    $options: "i",
                };
            }



            // AMENITIES FILTER

            if (amenities) {

                const amenitiesArray = amenities.split(',');

                query.amenities = {
                    $in: amenitiesArray
                };
            }



            // PRICE FILTER

            if (minPrice || maxPrice) {

                query.price = {};

                if (minPrice) {
                    query.price.$gte = Number(minPrice);
                }

                if (maxPrice) {
                    query.price.$lte = Number(maxPrice);
                }
            }



            const rooms = await roomsCollection.find(query).toArray();

            res.send(rooms);
        });






        // GET SINGLE ROOM (PRIVATE ROUTE)

        app.get('/rooms/:roomId', logger, verifyToken, async (req, res) => {

            const { roomId } = req.params;

            const query = {
                _id: new ObjectId(roomId)
            };

            const result = await roomsCollection.findOne(query);

            console.log(req.user);

            res.send(result);
        });






        // FEATURED ROOMS

        app.get('/featured', async (req, res) => {

            const cursor = roomsCollection.find().limit(6);

            const featuredRooms = await cursor.toArray();

            res.send(featuredRooms);
        });






        // CREATE BOOKING (PRIVATE ROUTE)

        app.post('/bookings', verifyToken, async (req, res) => {

            const bookingData = req.body;

            const {
                roomId,
                bookingDate,
                startTime,
                endTime
            } = bookingData;



            // BOOKING CONFLICT CHECK

            const existingBooking = await bookingsCollection.findOne({

                roomId,
                bookingDate,

                startTime: {
                    $lt: endTime
                },

                endTime: {
                    $gt: startTime
                }
            });




            if (existingBooking) {

                return res.status(400).send({
                    message: 'Room already booked for this time'
                });
            }




            const result = await bookingsCollection.insertOne({

                ...bookingData,

                userId: req.user.sub
            });

            res.send(result);
        });






        // GET MY BOOKINGS (PRIVATE ROUTE)

        app.get('/my-bookings', verifyToken, async (req, res) => {

            const email = req.user.email;

            const query = {
                userEmail: email
            };

            const result = await bookingsCollection.find(query).toArray();

            res.send(result);
        });






        // CANCEL BOOKING (PRIVATE ROUTE)

        app.delete('/bookings/:id', verifyToken, async (req, res) => {

            const { id } = req.params;

            const query = {
                _id: new ObjectId(id)
            };

            const result = await bookingsCollection.deleteOne(query);

            res.send(result);
        });






        console.log("MongoDB Connected Successfully");

    } finally {

        // await client.close();

    }
}

run().catch(console.dir);






// ROOT ROUTE

app.get('/', (req, res) => {

    res.send('NookNest Server Running');
});






// SERVER

app.listen(PORT, () => {

    console.log(`Server is running on http://localhost:${PORT}`);
});