import express from 'express';
import dotenv from 'dotenv';
import connectDB from './db/index.js';
dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();
connectDB()
.then(()=>{
    app.listen(PORT || 3000 , () =>{
        console.log("Server running at PORT" , PORT);
    })
})
.catch((error) =>{
    console.log("Database connection failure" , error);
})
