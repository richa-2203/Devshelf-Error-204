const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: String,
  description: String,
  author: String,
  genre: String,
  department: String,
  count: Number,
  vendor: String,
  vendor_id: Number,
  publisher: String,
  publisher_id: Number
});

const Book = mongoose.model('Book', bookSchema,'book');
module.exports=Book;


