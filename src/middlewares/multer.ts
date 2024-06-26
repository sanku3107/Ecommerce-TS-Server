import multer from "multer";
import { v4 as uuidv4 } from 'uuid';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    // console.log("insidefilename fxn", file);
    const random = uuidv4();
    cb(null, random + "" + file.originalname);
  },
});
export const singleUpload = multer({ storage }).single("photo");
