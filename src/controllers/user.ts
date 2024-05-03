import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.js";
import { newUserRequestBody } from "../types/types.js";
import { TryCatch } from "../middlewares/error.js";
import ErrorHandler from "../utils/utility-class.js";

export const newUser = TryCatch(
  async (
    req: Request<{}, {}, newUserRequestBody>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { name, email, photo, gender, _id, dob } = req.body;

      let user = await User.findById(_id);

      if (user) {
        return res.status(200).json({
          success: true,
          message: `Welcome, ${user.name}`,
        });
      }

      if (!_id || !name || !email || !photo || !gender || !dob) {
        return next(new ErrorHandler("Please add all the fields.", 400));
      }
      user = await User.create({
        name,
        email,
        photo,
        gender,
        _id,
        dob: new Date(dob),
      });

      return res.status(201).json({
        success: true,
        message: `welcome, ${user.name}`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error,
      });
    }
  }
);

export const getAllUsers = TryCatch(async (req,res,next)=>{
  const users = await User.find();

  return res.status(200).json({
    success:true,
    users,
  })
});

export const getUser = TryCatch(async (req,res,next)=>{
  const id = req.params.id;

  const user = await User.findById(id);
  if(!user){
    return next(new ErrorHandler("Invalid User ID",400))
  }
  return res.status(200).json({
    success:true,
    user,
  })
})

export const deleteUser = TryCatch(async (req,res,next)=>{
  const id = req.params.id;

  const user = await User.findById(id);
  if(!user){
    return next(new ErrorHandler("Invalid User ID",400))
  }

  await user.deleteOne();
  return res.status(200).json({
    success:true,
    message:"User deleted Successfully",
  })
})


