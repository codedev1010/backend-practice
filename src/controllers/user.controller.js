import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
const generateAccessandRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshTokens = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    }
    catch (err) {
        throw new ApiError(500, "Failure in generating tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //  taking values from the frontend or the request 
    const { fullName, email, username, password } = req.body

    //  checking if all the fields are non empty or not
    if (
        [fullName, email, username, password].some((val) => val?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // checking if there is a existing user in the db by the same username or email id

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // getting the local file path of avatar and cover image using multer 

    let avatarLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.avatar) &&
        req.files.avatar.length > 0
    ) {
        avatarLocalPath = req.files.avatar[0].path;
    }
    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }
    console.log("avatarLocalPath : ", avatarLocalPath)
    console.log("coverImagePath : ", coverImageLocalPath)

    // uploading the avatar and imagecover on cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "avatar file is required")
    }
    //  creating the instance of the user in the db 

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })
    // sendind a response back to the request but not including the password and the refresh token
    const createdUser = await User.findById(user._id).select(
        "-password -refreshTokens"
    )

    if (!createdUser) {
        throw new ApiError(500, " Server error registering user")
    }
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})
const loginUser = asyncHandler(async (req, res) => {
    console.log("req.body : ", req.body)
    const { email, username, password } = req.body
    console.log(email, " ", username, " ", password)

    if (!username || !email) {
        throw new ApiError(400, "Both fields are required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(400, "User with given email or username does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid user credentials")
    }
    const { accessToken, refreshToken } = await generateAccessandRefreshTokens(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshTokens")

    const options = {
        httpOnly: true,
        secure: true
    }
    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshTokens: 1
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }
    const LoggedoutUser = await User.findById(req.user._id).select("-password -refreshTokens");
    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, { "loggedout user details": LoggedoutUser }, "User logged out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    // console.log("incoming refresh token from server : " , incomingRefreshToken)
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_KEY
        )
        // console.log("Decoded token :" , decodedToken)
        const user = await User.findById(decodedToken._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
        // console.log("user : " , user )
        // console.log("refresh token from user model in database : " , user.refreshTokens)
        if (incomingRefreshToken !== user?.refreshTokens) {
            throw new ApiError(401, "Refresh token is expired or used or tampered")
        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const { accessToken, newRefreshToken } = await generateAccessandRefreshTokens(user._id)
        return res.status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, newRefreshToken },
                    "access token refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token")
    }
})

export { registerUser, loginUser, logoutUser, refreshAccessToken };

