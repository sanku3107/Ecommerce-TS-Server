import express from "express";

import { adminOnly } from "../middlewares/auth.js";
import {
  createProduct,
  deleteProduct,
  getAdminProducts,
  getAllProducts,
  getLatestProducts,
  getSingleProduct,
  getUniqueCategory,
  updateProduct,
} from "../controllers/product.js";
import { singleUpload } from "../middlewares/multer.js";

const app = express.Router();

app.post("/new", adminOnly, singleUpload, createProduct);

app.get("/all",getAllProducts);

app.get("/latest", getLatestProducts);
app.get("/categories", getUniqueCategory);

app.get("/admin-products", adminOnly,getAdminProducts);

app.route("/:id").get(getSingleProduct).put(adminOnly,singleUpload,updateProduct).delete(adminOnly,deleteProduct);

export default app;
