const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'c237_petshopdb' // Database name
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
// enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

// Session Middleware
app.use(session({
    secret: 'secret', // Session secret
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/purchase'); // Redirect to purchase for non-admins
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !!contact || !role) {
        return res.status(400).send('All fields are required.');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

app.get('/managePets', checkAuthenticated, checkAdmin, (req, res) => { // Changed from /inventory to /managePets
    // Fetch data from MySQL
    connection.query('SELECT * FROM pets', (error, results) => {
        if (error) throw error;
        res.render('managePets', { pets: results, user: req.session.user }); // Changed 'inventory' to 'managePets'
    });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            if (req.session.user.role == 'user')
                res.redirect('/purchase'); // Redirect to purchase for users
            else
                res.redirect('/managePets'); // Changed from /inventory to /managePets
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/purchase', checkAuthenticated, (req, res) => {
    // Fetch data from MySQL
    connection.query('SELECT * FROM pets', (error, results) => {
        if (error) throw error;
        res.render('purchase', { user: req.session.user, pets: results });
    });
});

app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const petId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1;

    connection.query('SELECT * FROM pets WHERE petId = ?', [petId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            const pet = results[0];

            // Initialize cart in session if not exists
            if (!req.session.cart) {
                req.session.cart = [];
            }

            // Check if pet already in cart
            const existingItem = req.session.cart.find(item => item.petId === petId);
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                req.session.cart.push({
                    petId: pet.petId,
                    petName: pet.petName,
                    price: pet.price,
                    quantity: quantity,
                    image: pet.image
                });
            }

            res.redirect('/cart');
        } else {
            res.status(404).send("Pet not found");
        }
    });
});

app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/pet/:id', checkAuthenticated, (req, res) => {
    // Extract the pet ID from the request parameters
    const petId = req.params.id;

    // Fetch data from MySQL based on the pet ID
    connection.query('SELECT * FROM pets WHERE petId = ?', [petId], (error, results) => {
        if (error) throw error;

        // Check if any pet with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the pet data
            res.render('pet', { pet: results[0], user: req.session.user });
        } else {
            // If no pet with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('Pet not found');
        }
    });
});

app.get('/addPet', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addPet', { user: req.session.user });
});

app.post('/addPet', upload.single('image'), (req, res) => {
    // Extract pet data from the request body
    const { name, quantity, price } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO pets (petName, quantity, price, image) VALUES (?, ?, ?, ?)';
    // Insert the new pet into the database
    connection.query(sql, [name, quantity, price, image], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding pet:", error);
            res.status(500).send('Error adding pet');
        } else {
            // Send a success response
            res.redirect('/managePets'); // Changed from /inventory to /managePets
        }
    });
});

app.get('/updatePet/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const petId = req.params.id;
    const sql = 'SELECT * FROM pets WHERE petId = ?';

    // Fetch data from MySQL based on the pet ID
    connection.query(sql, [petId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            // Render HTML page with the pet data
            res.render('updatePet', { pet: results[0] });
        } else {
            // If no pet with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('Pet not found');
        }
    });
});

app.post('/updatePet/:id', upload.single('image'), (req, res) => {
    const petId = req.params.id;
    // Extract pet data from the request body
    const { name, quantity, price } = req.body;
    let image = req.body.currentImage; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    }

    const sql = 'UPDATE pets SET petName = ?, quantity = ?, price = ?, image =? WHERE petId = ?';
    // Insert the new pet into the database
    connection.query(sql, [name, quantity, price, image, petId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error updating pet:", error);
            res.status(500).send('Error updating pet');
        } else {
            // Send a success response
            res.redirect('/managePets'); // Changed from /inventory to /managePets
        }
    });
});

app.get('/deletePet/:id', (req, res) => {
    const petId = req.params.id;

    connection.query('DELETE FROM pets WHERE petId = ?', [petId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error deleting pet:", error);
            res.status(500).send('Error deleting pet');
        } else {
            // Send a success response
            res.redirect('/managePets'); // Changed from /inventory to /managePets
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
