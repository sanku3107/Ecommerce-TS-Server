import { Request } from "express";
import { TryCatch } from "../middlewares/error.js";
import {
  BaseQuery,
  SearchRequestQuery,
  newProductRequestBody,
} from "../types/types.js";
import { Product } from "../models/product.js";
import ErrorHandler from "../utils/utility-class.js";
import fs from "fs";
import { myCache } from "../app.js";
import { json } from "stream/consumers";
import { invalidateCache } from "../utils/features.js";
import cloudinary from "cloudinary";
// import {faker} from "@faker-js/faker";

//get latest products
//revalidate cache on New,Update,Delete Product and on new order
export const getLatestProducts = TryCatch(
  async (req: Request<{}, {}, newProductRequestBody>, res, next) => {
    let products;
    if (myCache.has("latest-products"))
      products = JSON.parse(myCache.get("latest-products") as string);
    else {
      products = await Product.find({}).sort({ createdAt: -1 }).limit(5);
      myCache.set("latest-products", JSON.stringify(products));
    }
    return res.status(200).json({
      success: true,
      products,
    });
  }
);

//get all unique categories
//revalidate cache on New,Update,Delete Product and on new order
export const getUniqueCategory = TryCatch(
  async (req: Request<{}, {}, newProductRequestBody>, res, next) => {
    let categories;
    if (myCache.has("categories"))
      categories = JSON.parse(myCache.get("categories") as string);
    else {
      categories = await Product.distinct("category");
      myCache.set("categories", JSON.stringify(categories));
    }
    return res.status(200).json({
      success: true,
      categories,
    });
  }
);

//get admin Products
//revalidate cache on New,Update,Delete Product and on new order
export const getAdminProducts = TryCatch(async (req, res, next) => {
  let products;
  if (myCache.has("all-products"))
    products = JSON.parse(myCache.get("all-products") as string);
  else {
    products = await Product.find();
    myCache.set("all-products", JSON.stringify(products));
  }
  return res.status(200).json({
    success: true,
    products,
  });
});

//get single product
export const getSingleProduct = TryCatch(async (req, res, next) => {
  let product;
  const id = req.params.id;
  if (myCache.has(`product-${id}`))
    product = JSON.parse(myCache.get(`product-${id}`) as string);
  else {
    product = await Product.findById(id);
    if (!product) {
      return next(new ErrorHandler("Product not found", 404));
    }
    myCache.set(`product-${id}`, JSON.stringify(product));
  }
  return res.status(200).json({
    success: true,
    product,
  });
});

//create a new Product
export const createProduct = TryCatch(
  async (req: Request<{}, {}, newProductRequestBody>, res, next) => {
    const { name, price, stock, category } = req.body;

    const photo = req.file?.path;
    if (!photo) {
      return next(new ErrorHandler("Please add photo", 400));
    }

    const myCloud = await cloudinary.v2.uploader.upload(photo);

    if (!name || !price || !stock || !category) {
      fs.unlinkSync(photo);
      return next(new ErrorHandler("Please add all fields", 400));
    }

    try {
      await Product.create({
        name,
        price,
        stock,
        category: category.toLowerCase(),
        photo: myCloud.secure_url,
      });

      // File deletion should happen after the product is successfully created
      fs.unlinkSync(photo);

      invalidateCache({ product: true, admin: true });

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
      });
    } catch (error) {
      // Clean up the uploaded file if there was an error creating the product
      fs.unlinkSync(photo);
      return next(error);
    }
  }
);

//update product
export const updateProduct = TryCatch(async (req: Request, res, next) => {
  const { id } = req.params;
  const { name, price, stock, category } = req.body;
  const file = req.file?.path;
  
  const product = await Product.findById(id);

  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }

  if (file) {
    // Upload new photo to Cloudinary
    const myCloud = await cloudinary.v2.uploader.upload(file);

    // Delete the old photo file
    fs.unlinkSync(file);

    // If the product has an existing photo, delete it from Cloudinary
    if (product.photo) {
      const publicId = extractPublicIdFromUrl(product.photo);
      if (publicId) {
        await cloudinary.v2.uploader.destroy(publicId);
      }
    }

    product.photo = myCloud.secure_url;
  }

  if (name) {
    product.name = name;
  }
  if (price) {
    product.price = price;
  }
  if (stock) {
    product.stock = stock;
  }
  if (category) {
    product.category = category.toLowerCase();
  }
  
  await product.save();
  
  invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });

  return res.status(200).json({
    success: true,
    message: "Product updated successfully",
  });
});

const extractPublicIdFromUrl = (url: string): string | null => {
  const match = /\/v\d+\/(.+)\.[a-z]+$/.exec(url);
  return match ? match[1] : null;
};

//delete product
export const deleteProduct = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const product = await Product.findById(id);
  if (!product) {
    return next(new ErrorHandler("Product not found", 404));
  }
  if (product.photo) {
    const publicId = extractPublicIdFromUrl(product.photo);
    if (publicId) {
      await cloudinary.v2.uploader.destroy(publicId);
    }
  }
  await product.deleteOne();
  invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });
  return res.status(200).json({
    success: true,
    message: "Product deleted successfully",
  });
});

//get all products
export const getAllProducts = TryCatch(
  async (req: Request<{}, {}, {}, SearchRequestQuery>, res, next) => {
    const { search, category, price, sort } = req.query;
    const page = Number(req.query.page) || 1;

    const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
    const skip = limit * (page - 1);

    const baseQuery: BaseQuery = {};

    if (search)
      baseQuery.name = {
        $regex: search,
        $options: "i",
      };

    if (price)
      baseQuery.price = {
        $lte: Number(price),
      };

    if (category) baseQuery.category = category;

    const [products, filteredOnlyProduct] = await Promise.all([
      Product.find(baseQuery)
        .sort(sort && { price: sort === "asc" ? 1 : -1 })
        .limit(limit)
        .skip(skip),
      Product.find(baseQuery),
    ]);

    const totalPage = Math.ceil(filteredOnlyProduct.length / limit);
    return res.status(200).json({
      success: true,
      products,
      totalPage,
    });
  }
);

// to generate fake products
// const generateFakeProducts = async (count: number = 10) =>{
//   const products = [];
//   for(let i=0;i<count;i++){
//     const product = {
//       name:faker.commerce.productName(),
//       photo:"uploads/4a113206-51c7-4f6f-9eb9-95a4bde4604a.png",
//       price:faker.commerce.price({min:1500,max:80000,dec:0}),
//       stock:faker.commerce.price({min:0,max:100,dec:0}),
//       category:faker.commerce.department(),
//       createdAt:new Date(faker.date.past()),
//       updatedAt:new Date(faker.date.recent()),
//       __v:0,
//     }
//     products.push(product);
//   }

//   await Product.create(products);
//   console.log({success:true});
// };

// const deleteFakeProduct = async(count:number=10)=>{
//   const products = await Product.find({}).skip(2);
//   for(let i=0;i<count;i++){
//     const product = products[i];
//     await product.deleteOne();
//   }
//   console.log({success:true});
// }
// deleteFakeProduct(49)
