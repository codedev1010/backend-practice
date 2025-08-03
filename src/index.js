import dotenv from 'dotenv';
import connectDB from './db/index.js';
import app from './app.js';
dotenv.config();
const PORT = process.env.PORT || 3000;
connectDB()
.then(()=>{
    app.listen(PORT || 3000 , () =>{
        console.log("Server running at PORT" , PORT);
    })
})
.catch((error) =>{
    console.log("Database connection failure" , error);
})