const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();

// Database connection
const db = mysql.createConnection({
    host: 'lk-80q.h.filess.io',
    user: 'C237Database_shoutbarn',
    password: 'ead1b5ac93a3c24b1cb229599f4fa60fbcb672b3',
    database: 'C237Database_shoutbarn',
    port: 3307
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database');
});

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));
app.use(flash());
app.set('view engine', 'ejs');

// Auth middleware
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to view this page.');
    res.redirect('/login');
};

const checkStaff = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'staff') return next();
    req.flash('error', 'Access denied: Staff only.');
    res.redirect('/dashboard');
};

// Routes

app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

app.get('/register', (req, res) => {
    res.render('register', {
        messages: req.flash('error'),
        formData: req.flash('formData')[0]
    });
});

const validateRegistration = (req, res, next) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 characters long.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    next();
};

const checkDuplicateUsername = (req, res, next) => {
    const { username } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.flash('error', 'Username already exists.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }
        next();
    });
};

app.post('/register', validateRegistration, checkDuplicateUsername, (req, res) => {
    const { username, password, role } = req.body;
    const sql = 'INSERT INTO users (username, password, role) VALUES (?, SHA1(?), ?)';
    db.query(sql, [username, password, role], (err, result) => {
        if (err) throw err;
        req.flash('success', 'Registration successful. Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE username = ? AND password = SHA1(?)';
    db.query(sql, [username, password], (err, results) => {
        if (err) throw err;
        if (results.length === 0) {
            req.flash('error', 'Invalid username or password.');
            return res.redirect('/login');
        }

        req.session.user = results[0];
        req.flash('success', 'Login successful!');
        res.redirect('/dashboard');
    });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

app.get('/staff', checkAuthenticated, checkStaff, (req, res) => {
    res.render('staff', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// Start server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
