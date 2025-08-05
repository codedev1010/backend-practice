import dotenv from "dotenv";
dotenv.config();
import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";
cloudinary.config({ 
        cloud_name: process.env.CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
});
const uploadOnCloudinary = async(localFilePath) =>{
    try{
        if(!localFilePath) return null
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type : 'auto'
        })
        fs.unlinkSync(localFilePath)
        console.log("file has been uploaded")
        // console.log(response)
        return response;
    }
    catch(error){
        console.log("Cloudinary upload error:", error);
       if (fs.existsSync(localFilePath)) {
           fs.unlinkSync(localFilePath);
       }
       console.log("file upload failed")
       return null;
    }
}
export {uploadOnCloudinary};