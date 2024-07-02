const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
const mongoURI = "mongodb://localhost:27017/LibraryDB";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Define Mongoose schemas and models
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  favourite_book: String,
  favourite_author: String,
  books_issued: [{
    title: String,
    issue_date: Date,
    due_date: Date
  }]
});


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

const User = mongoose.model("User", userSchema);
const Book = mongoose.model("Book", bookSchema, 'book');

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Received login request:", email, password);

  try {
    const user = await User.findOne({ email, password });
    if (user) {
      const encodedBooksIssued = encodeURIComponent(JSON.stringify(user.books_issued));
      res.redirect(`/profile.html?username=${user.username}&email=${user.email}&fav_author=${user.favourite_author}&fav_book=${user.favourite_book}&books_issued=${encodedBooksIssued}`);
    } else {
      res.send("Invalid credentials. Please try again.");
    }
  } catch (error) {
    console.error("Error querying user data:", error);
    res.status(500).send("Server error");
  }
});

app.post("/register", async (req, res) => {
  const { username, email, password, favourite_book, favourite_author } = req.body;

  // Check if the email is of the required format
  const emailRegex =  /^[a-zA-Z0-9._%+-]+@iitdh\.ac\.in$/;
  const isEmailValid = emailRegex.test(email);

  console.log("Email validation result:", isEmailValid); // Debugging log
  if (!isEmailValid) {
    console.log("Invalid email format:", email); // Debugging log
    return res.status(400).send('Email ID type not valid. Please use an IITDH email ID to <a href="/register">register</a>.');
  }

  const newUser = new User({
    username,
    email,
    password,
    favourite_book,
    favourite_author,
    books_issued: []
  });

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log("Username already taken:", username); // Debugging log
      return res.status(400).send("Username already taken");
    }

    await newUser.save();
    res.send('Registration successful. You can now <a href="/">login</a>.');
  } catch (error) {
    console.error("Error saving user data:", error);
    res.status(500).send("Server error");
  }
});


app.get('/search', async (req, res) => {
  const title = req.query.title;
  console.log(`Searching for book title containing: ${title}`);
  
  try {
    const regex = new RegExp(title, 'i'); // Create a regex object
    const bookMatches = await Book.find({ title: { $regex: regex } });
    console.log(bookMatches);
    if (bookMatches.length > 0) {
      res.json(bookMatches);
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
  } catch (error) {
    console.error("Error searching for books:", error);
    res.status(500).send("Server error");
  }
});

app.post('/add-to-cart', async (req, res) => {
  const { email, title } = req.body;
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(issueDate.getDate() + 1); // Set due date to 1 days after issue date

  try {
    const user = await User.findOne({ email });
    if (user) {
      const book = await Book.findOne({ title });
      if (book && book.count > 0) {
        book.count -= 1;
        user.books_issued.push({ title, issue_date: issueDate, due_date: dueDate });

        await book.save();
        await user.save();

        res.send("Book added to cart and count updated successfully.");
      } else {
        res.status(404).send("Book not found or out of stock");
      }
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error updating user or book data:", error);
    res.status(500).send("Server error");
  }
});
const cron = require('node-cron');

//const cron = require('node-cron');

cron.schedule('0 0 * * *', async () => { // Run every day at midnight
  try {
    const users = await User.find({});
    users.forEach(async (user) => {
      const now = new Date();
      user.books_issued = user.books_issued.filter(book => {
        if (book.due_date < now) {
          // Automatically return the book
          returnBook(book.title, user.email);
          return false; // Remove the book from issued list
        }
        return true;
      });
      await user.save();
    });
  } catch (error) {
    console.error("Error checking overdue books:", error);
  }
});



app.post('/return-book', async (req, res) => {
  const { email, title } = req.body;

  try {
    const user = await User.findOne({ email });
    const book = await Book.findOne({ title });

    if (user && book) {
      user.books_issued = user.books_issued.filter(b => b.title !== title);
      book.count += 1;

      await user.save();
      await book.save();

      res.json({ message: 'Book returned successfully.' });
    } else {
      res.status(404).json({ message: 'User or book not found.' });
    }
  } catch (error) {
    console.error('Error returning book:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});


// Recommendation route
app.post('/recommendations', async (req, res) => {
  const { booksIssued } = req.body;
  console.log('Books issued:', booksIssued); // Debugging log

  try {
    const issuedBooks = await Book.find({ title: { $in: booksIssued.map(book => book.title) } });
    console.log('Issued Books:', issuedBooks); // Debugging log
    const recommendations = new Set();

    await Promise.all(issuedBooks.map(async book => {
      const { author, genre, department } = book;
      const matches = await Book.find({
        $or: [
          { author: author },
          { genre: genre },
          { department: department },
          { title: { $regex: book.title.split(' ').join('|'), $options: 'i' } }
        ],
        title: { $nin: booksIssued.map(book => book.title) }
      }).limit(5 - recommendations.size);

      matches.forEach(match => {
        if (recommendations.size < 5) {
          recommendations.add(match);
        }
      });
    }));

    console.log('Recommendations:', recommendations); // Debugging log
    res.json([...recommendations]);

  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});




app.get('/profile', async (req, res) => {
  const email = req.query.email;

  try {
    const user = await User.findOne({ email });
    if (user) {
      res.json(user);
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error querying user data:", error);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
