import { User } from "../models/user.js";
import ErrorHandler from "../utils/utility-class.js";
import { TryCatch } from "./error.js";


//Middleware to make sure that only admin is allowed
export const adminOnly = TryCatch(async(req,res,next)=>{
    const {id} = req.query

    if(!id){
        return next(new ErrorHandler("please login first",401))
    }

    const user = await User.findById(id);
    if(!user){
        return next(new ErrorHandler("Wrong ID",401))
    }
    if(user.role !== "admin"){
        return next(new ErrorHandler("You are not authorized personnel",401))
    }

    next();
})