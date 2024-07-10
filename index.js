// Importing required modules
const express = require("express"); // Import the Express framework
const app = express(); // Create an instance of Express application
const path = require("path"); // Provides utilities for working with file and directory paths
const bodyParser = require("body-parser"); // Middleware for parsing incoming request bodies
const mongoose = require("mongoose"); // MongoDB object modeling tool for Node.js
const nodemailer = require("nodemailer"); // Module for sending emails from Node.js
const crypto = require("crypto"); // Module for cryptographic functions
const cron = require('node-cron'); // Module for scheduling tasks using cron syntax

// Middleware to parse URL-encoded data from <form> submissions
app.use(bodyParser.urlencoded({ extended: false }));

// Middleware to parse JSON payloads
app.use(bodyParser.json());

// Middleware to serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));


// MongoDB connection
const mongoURI = "mongodb://localhost:27017/LibraryDB";
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));


// Define user schema
const userSchema = new mongoose.Schema({
  username: String, // User's username
  email: String, // User's email address
  password: String, // User's password (hashed)
  favourite_book: String, // User's favorite book
  favourite_author: String, // User's favorite author
  books_issued: [{ // Array of books issued to the user
    title: String, // Title of the book
    issue_date: Date, // Date the book was issued
    due_date: Date // Due date for returning the book
  }]
});

const userSchema_otp = new mongoose.Schema({
  
  email: String, // User's email address
  otp: String,
  otpExpires: Date,
});


// Define book schema
const bookSchema = new mongoose.Schema({
  title: String, // Title of the book
  description: String, // Description of the book
  author: String, // Author of the book
  genre: String, // Genre of the book
  department: String, // Department associated with the book
  count: Number, // Number of copies available
  vendor: String, // Vendor of the book
  vendor_id: Number, // Vendor's ID
  publisher: String, // Publisher of the book
  publisher_id: Number // Publisher's ID
});

// Define review schema
const reviewSchema = new mongoose.Schema({
  email: String, // Email of the user who submitted the review
  title: String, // Title of the book being reviewed
  review: String, // Review content
  rating: Number, // Rating given by the user
  review_date: Date // Date when the review was submitted
});


// Define Mongoose model for Review collection
const Review = mongoose.model("Review", reviewSchema);

// Define Mongoose model for users collection
const User = mongoose.model("users", userSchema);

// Define Mongoose model for Book collection with explicit collection name 'book'
const Book = mongoose.model("Book", bookSchema, 'book');

// Define Mongoose model for Book collection with explicit collection name 'book'
const User_otp = mongoose.model("user_otp", userSchema_otp);

// Route to serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html")); // Send index.html located in the public directory
});


// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail', // Using Gmail service
  auth: {
    user: 'ded66521@gmail.com', // Your Gmail account
    pass: 'nbnl xhhx zmqz ymvb' // Your Gmail account password or app password
  }
});

// Function to send OTP email
const sendOtpEmail = (email, otp) => {
  const mailOptions = {
    from: 'ded66521@gmail.com', // Sender email address
    to: email, // Recipient email address
    subject: 'Your OTP for Registration', // Email subject
    text: `Your OTP is ${otp} new code` // Email body with OTP message
  };

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error); // Log error if sending fails
    } else {
      console.log('Email sent:', info.response); // Log confirmation if email is sent successfully
    }
  });
};

// Function to send reminder email
const sendReminderEmail2 = async (user, book) => {
  // Construct email options
  const mailOptions = {
    from: 'ded66521@gmail.com', // Replace with your email address
    to: user.email, // Recipient's email address
    subject: 'Reminder: Please return overdue book', // Email subject
    text: `Dear ${user.username},\n\n` + // Email body with user's username
          `This is a reminder that you have not returned the book "${book.title}" which was due on ${user.books_issued.dueDate}.\n\n` + // Include book title and due date
          `Please return the book at your earliest convenience.\n\n` + // Reminder message
          `Thank you.\n\n` +
          `Best regards,\nLibrary Management System` // Closing message
  };

  try {
    // Send email using nodemailer transporter
    const info = await transporter.sendMail(mailOptions);
    console.log(`Reminder email sent to ${user.email} for book "${book.title}".`); // Log success message
  } catch (error) {
    console.error('Error sending reminder email:', error); // Log any errors that occur during email sending
  }
};


// Route to send OTP
app.post("/send-otp", async (req, res) => {
  const { email } = req.body; // Extract email from request body
   // Check if the email is of the required format (IITDH email format)
   const emailRegex = /^[a-zA-Z0-9._%+-]+@iitdh\.ac\.in$/;
   const isEmailValid = emailRegex.test(email); // Validate email format
 
   console.log("Email validation result:", isEmailValid); // Debugging log
   if (!isEmailValid) {
     console.log("Invalid email format:", email); // Debugging log
     return res.status(400).send('Email ID type not valid. Please use an IITDH email ID to <a href="/register">register</a>.');
   }

  // Check if username or email already exists in the database
  
  const existingUser2 = await User.findOne({ email });
  if (existingUser2) {
    console.log("Email already taken:", email); // Debugging log
    return res.status(400).send("Email already taken");
  }


  // Generate OTP
  const otp = crypto.randomInt(100000, 999999).toString(); // Generate a random OTP between 100000 and 999999

  // Set OTP expiration time (5 minutes from now)
  const otpExpires = Date.now() + 5 * 60 * 1000; // Calculate OTP expiration time (5 minutes in milliseconds)

  try {
    // Check if user with the provided email exists in the database
    const user = await User_otp.findOne({ email });
    if (user) {
      // Update existing user with new OTP and expiration time
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save(); // Save updated user details
    } else {
      // Create a new user with the provided email, OTP, and expiration time
      const newUser = new User_otp({ email, otp, otpExpires });
      await newUser.save(); // Save new user details to the database
    }

    // Send OTP email using nodemailer
    sendOtpEmail(email, otp);

    // Send success response to the client
    res.send("OTP sent successfully");
  } catch (error) {
    console.error("Error sending OTP:", error); // Log any errors that occur
    res.status(500).send("Server error"); // Send an error response to the client
  }
});

// Route for user login
app.post("/login", async (req, res) => {
  const { email, password } = req.body; // Extract email and password from request body
  console.log("Received login request:", email, password); // Log the received login request

  try {
    // Find user with matching email and password
    const user = await User.findOne({ email, password });

    // If user exists, redirect to profile.html with user data
    if (user) {
      // Encode and stringify user's issued books data for URL compatibility
      const encodedBooksIssued = encodeURIComponent(JSON.stringify(user.books_issued));
      
      // Redirect to profile.html with user data as query parameters
      res.redirect(`/profile.html?username=${user.username}&email=${user.email}&fav_author=${user.favourite_author}&fav_book=${user.favourite_book}&books_issued=${encodedBooksIssued}`);
    } else {
      // Send error message for invalid credentials
      res.send("Invalid credentials. Please try again.");
    }
  } catch (error) {
    // Handle server error during user data query
    console.error("Error querying user data:", error);
    res.status(500).send("Server error");
  }
});
// Route to verify OTP
app.post("/verify-otp", async (req, res) => {
  const { email, otp, username, password, favourite_book, favourite_author } = req.body; // Extract necessary fields from request body

  try {
    // Find user with matching email and OTP
    const user = await User_otp.findOne({ email, otp });
    // Check if user exists and OTP is not expired
    if (user && user.otpExpires > Date.now()) {
      // Delete the user record after successful verification
      await User_otp.deleteOne({ email, otp });

      const newUser = new User({
        username,
        email,
        password,
        favourite_book,
        favourite_author,
        books_issued:[]
      });
      await newUser.save(); // Save the new user record to the database

      // Send a success response indicating registration was successful
      res.send("Registration successful. You can now "); // Add your further steps or redirection here
    } else {
      // Send an error response if OTP is invalid or expired
      res.status(400).send("Invalid or expired OTP");
    }
  } catch (error) {
    // Handle any errors that occur during OTP verification
    console.error("Error verifying OTP:", error);
    res.status(500).send("Server error"); // Send an error response to the client
  }
});


// Route for user registration
app.post("/register", async (req, res) => {
  const { username, email, password, favourite_book, favourite_author } = req.body; // Extract fields from request body

  // Create a new user object with provided data
  await User.deleteOne({ email });
  const newUser = new User({
    username,
    email,
    password,
    favourite_book,
    favourite_author,
    books_issued: [] // Initialize with an empty array for books issued
  });
  try {
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log("Username already taken:", username); // Debugging log
      return res.status(400).send("Username already taken");
    }
    // Save the new user document to the database
    await newUser.save();
    
    res.send('Registration successful. You can now login.'); // Send success response
  } catch (error) {
    console.error("Error saving user data:", error); // Log any errors that occur during user save
    res.status(500).send("Server error"); // Send server error response
  }
});

// Route for searching books
app.get('/search', async (req, res) => {
  const title = req.query.title; // Extract the 'title' query parameter from the request
  console.log(`Searching for book title containing: ${title}`); // Log the search query
  
  try {
    const regex = new RegExp(title, 'i'); // Create a case-insensitive regex pattern for title search
    const bookMatches = await Book.find({ title: { $regex: regex } }); // Find books that match the regex pattern

    if (bookMatches.length > 0) {
      res.json(bookMatches); // Send JSON response with matched books
    } else {
      res.status(404).json({ message: 'Book not found' }); // Send 404 status with message if no books found
    }
  } catch (error) {
    console.error("Error searching for books:", error); // Log any errors that occur during book search
    res.status(500).send("Server error"); // Send server error response
  }
});

// Route for adding books to cart
app.post('/add-to-cart', async (req, res) => {
  const { email, title } = req.body;
  const issueDate = new Date(); // Current date and time
  const dueDate = new Date(issueDate);
  dueDate.setMinutes(issueDate.getMinutes() + 10); // Set due date to 10 minutes after issue date

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (user) {
      // Find the book by title
      const book = await Book.findOne({ title });
      if (book && book.count > 0) { // Check if the book exists and is in stock
        book.count -= 1; // Decrease the count of the book in stock
        // Add the book to the user's list of issued books
        user.books_issued.push({ title, issue_date: issueDate, due_date: dueDate });

        // Save the updated book and user information
        await book.save();
        await user.save();

        console.log(`Book "${book.title}" added to cart for user ${user.username}.`);

        // Schedule email reminder after 10 minutes using cron job
        const reminderTime = new Date();
        reminderTime.setMinutes(reminderTime.getMinutes() + 10); // Schedule reminder 10 minutes from now
        const cronString = `${reminderTime.getMinutes()} ${reminderTime.getHours()} * * *`;
        cron.schedule(cronString, async () => {
          try {
            console.log(`Sending reminder email to ${user.email} for book "${book.title}".`);
            await sendReminderEmail2(user, book); // Send reminder email using the previously defined function
          } catch (error) {
            console.error('Error scheduling reminder email:', error);
          }
        });

        res.send("Book added to cart and count updated successfully.");
      } else {
        res.status(404).send("Book not found or out of stock"); // Handle case where book is not found or out of stock
      }
    } else {
      res.status(404).send("User not found"); // Handle case where user is not found
    }
  } catch (error) {
    console.error("Error updating user or book data:", error); // Log and handle server errors
    res.status(500).send("Server error");
  }
});

// Route for returning books
app.post('/return-book', async (req, res) => {
  const { email, title } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    // Find the book by title
    const book = await Book.findOne({ title });

    // Check if both user and book exist
    if (user && book) {
      // Remove the returned book from user's books_issued array
      user.books_issued = user.books_issued.filter(b => b.title !== title);
      // Increase the count of the returned book in stock
      book.count += 1;

      // Save updated user and book information
      await user.save();
      await book.save();

      // Prepare response with redirection to review page
      res.json({
        message: 'Book returned successfully. Would you like to write a review?',
        redirectToReview: `/review.html?email=${email}&title=${title}`
      });
    } else {
      // Handle case where user or book is not found
      res.status(404).json({ message: 'User or book not found.' });
    }
  } catch (error) {
    console.error('Error returning book:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// // Route to submit a review with rating
app.post('/submit-review', async (req, res) => {
  const { email, title, review, rating } = req.body;

  // Create a new Review document
  const newReview = new Review({
    email,
    title,
    review,
    rating,
    review_date: new Date() // Timestamp the review submission
  });

  try {
    // Save the new review to the database
    await newReview.save();
    res.json({ message: 'Review submitted successfully.' }); // Respond with success message
  } catch (error) {
    console.error('Error submitting review:', error); // Log any errors that occur
    res.status(500).json({ message: 'Server error.' }); // Respond with an error message
  }
});

// Route to fetch book details including reviews
app.get('/book-details', async (req, res) => {
  const title = req.query.title; // Extract title from query parameters

  try {
    const book = await Book.findOne({ title }); // Find the book by title in the Book collection
    if (!book) {
      return res.status(404).json({ message: 'Book not found' }); // Return 404 if book is not found
    }

    // Find all reviews related to the book
    const reviews = await Review.find({ title });

    // Construct response object with book details and reviews
    const bookDetails = {
      title: book.title,
      description: book.description,
      author: book.author,
      genre: book.genre,
      department: book.department,
      count: book.count,
      vendor: book.vendor,
      vendor_id: book.vendor_id,
      publisher: book.publisher,
      publisher_id: book.publisher_id,
      reviews: reviews // Include reviews in the response
    };

    res.json(bookDetails); // Send the constructed book details JSON object as response
  } catch (error) {
    console.error('Error fetching book details:', error); // Log any errors that occur
    res.status(500).json({ message: 'Server error' }); // Return 500 status with an error message if there's a server error
  }
});

// Route to generate book recommendations
app.post('/recommendations', async (req, res) => {
  const { booksIssued } = req.body; // Extract the array of issued books from request body
  console.log('Books issued:', booksIssued); // Debugging log

  try {
    // Find all books currently issued by the user
    const issuedBooks = await Book.find({ title: { $in: booksIssued.map(book => book.title) } });
    console.log('Issued Books:', issuedBooks); // Debugging log

    const recommendations = new Set(); // Use a Set to store unique recommendations

    // Use Promise.all to asynchronously process each issued book
    await Promise.all(issuedBooks.map(async book => {
      const { author, genre, department } = book;

      // Find up to 5 books that match the author, genre, department, or title keywords of each issued book
      const matches = await Book.find({
        $or: [
          { author: author },
          { genre: genre },
          { department: department },
          { title: { $regex: book.title.split(' ').join('|'), $options: 'i' } } // Match keywords in title
        ],
        title: { $nin: booksIssued.map(book => book.title) } // Exclude already issued books
      }).limit(5 - recommendations.size); // Limit to 5 recommendations or less if fewer matches are found

      // Add matching books to recommendations Set
      matches.forEach(match => {
        if (recommendations.size < 5) {
          recommendations.add(match);
        }
      });
    }));

    console.log('Recommendations:', recommendations); // Debugging log
    res.json([...recommendations]); // Convert Set to array and send as JSON response

  } catch (error) {
    console.error('Error fetching recommendations:', error); // Log any errors that occur
    res.status(500).json({ error: 'Internal Server Error' }); // Return 500 status with an error message
  }
});

// Route to fetch user profile by email
app.get('/profile', async (req, res) => {
  const email = req.query.email; // Extract email from query parameters

  try {
    // Find user in MongoDB using email
    const user = await User.findOne({ email });

    if (user) {
      // If user found, send user data as JSON response
      res.json(user);
    } else {
      // If user not found, send 404 status with error message
      res.status(404).send("User not found");
    }
  } catch (error) {
    // Log and handle server errors
    console.error("Error querying user data:", error);
    res.status(500).send("Server error");
  }
});

// Route to get the last 5 books (New Arrivals)
app.get('/new-arrivals', async (req, res) => {
  try {
    // Find the last 5 books sorted by _id in descending order (recently added books)
    const books = await Book.find().sort({ _id: -1 }).limit(5);

    // Send the array of books as a JSON response
    res.json(books);
  } catch (error) {
    // Log and handle server errors
    console.error("Error fetching new arrivals:", error);
    res.status(500).send("Server error");
  }
});

const port = process.env.PORT || 3000; // Set the port from environment variable or default to 3000

app.listen(port, () => {
  console.log(`Server running on port ${port}`); // Log a message when the server starts listening
});
