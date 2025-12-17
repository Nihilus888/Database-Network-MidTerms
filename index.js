/**
* index.js
* This is your main app entry point
*/

// Set up express, bodyparser and EJS
const express = require('express');
const app = express();
const port = 3000;
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // set the app to use ejs for rendering
app.use(express.static(__dirname + '/public')); // set location of static files

// Set up SQLite
const sqlite3 = require('sqlite3').verbose();
global.db = new sqlite3.Database('./database.db', function(err){
    if(err){
        console.error(err);
        process.exit(1);
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON");

        // Create events table if it doesn't exist
        const createEventsTable = `
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('draft','published')),
                createdAt TEXT NOT NULL,
                publishedAt TEXT,
                tickets TEXT  -- can store JSON string of ticket counts
            );
        `;
        global.db.run(createEventsTable, (err) => {
            if(err){
                console.error("Error creating events table:", err);
            } else {
                console.log("Events table ready");
            }
        });

        // Create site_settings table if it doesn't exist
        const createSettingsTable = `
            CREATE TABLE IF NOT EXISTS site_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL
            );
        `;
        global.db.run(createSettingsTable, (err) => {
            if(err){
                console.error("Error creating site_settings table:", err);
            } else {
                console.log("site_settings table ready");

                // Insert default row if table is empty
                const insertDefault = `
                    INSERT INTO site_settings (name, description)
                    SELECT 'Stretch Yoga', 'Yoga classes for all ages and abilities'
                    WHERE NOT EXISTS (SELECT 1 FROM site_settings);
                `;
                global.db.run(insertDefault, (err) => {
                    if(err) console.error("Error inserting default site settings:", err);
                    else console.log("Default site settings ensured");
                });
            }
        });
    }
});

// Handle requests to the home page 
app.get('/', (req, res) => {
    res.render('main-home.ejs');
});

// Add all the route handlers in usersRoutes to the app under the path /users
const usersRoutes = require('./routes/users');
app.use('/users', usersRoutes);

// --- Organiser Home Page routes ---

// Display organiser home with published and draft events
// Organiser Home Page
app.get('/organiser-home', (req, res, next) => {
    // Get site settings (event manager info)
    const siteQuery = "SELECT * FROM site_settings LIMIT 1";
    global.db.get(siteQuery, (err, eventManager) => {
        if (err) return next(err);
        if (!eventManager) {
            return res.send("Site settings not found. Please set them up first.");
        }

        // Get published events
        const publishedQuery = "SELECT * FROM events WHERE status = 'published'";
        global.db.all(publishedQuery, (err, publishedEvents) => {
            if (err) return next(err);

            // Parse tickets JSON for each event
            publishedEvents.forEach(event => {
                try {
                    event.tickets = JSON.parse(event.tickets || '{}');
                } catch(e) {
                    event.tickets = {};
                }
            });

            // Get draft events
            const draftQuery = "SELECT * FROM events WHERE status = 'draft'";
            global.db.all(draftQuery, (err, draftEvents) => {
                if (err) return next(err);

                draftEvents.forEach(event => {
                    try {
                        event.tickets = JSON.parse(event.tickets || '{}');
                    } catch(e) {
                        event.tickets = {};
                    }
                });

                // Render the organiser-home.ejs with all data
                res.render('organiser-home.ejs', { 
                    eventManager, 
                    publishedEvents, 
                    draftEvents 
                });
            });
        });
    });
});

// Create new draft event
app.post('/events/create', (req, res, next) => {
    const query = `
        INSERT INTO events (title, date, status, createdAt)
        VALUES (?, ?, 'draft', datetime('now'))
    `;
    const query_parameters = ["New Event", "2025-12-31"];

    global.db.run(query, query_parameters, function(err) {
        if (err) return next(err);
        res.redirect(`/events/${this.lastID}/edit`);
    });
});

// Edit a specific event
app.get('/events/:id/edit', (req, res, next) => {
    const query = "SELECT * FROM events WHERE id = ?";
    global.db.get(query, [req.params.id], function(err, event) {
        if (err) return next(err);
        if (!event) return res.status(404).send("Event not found");
        res.render("edit-event.ejs", { event });
    });
});

// Publish a draft event
app.post('/events/:id/publish', (req, res, next) => {
    const query = `
        UPDATE events
        SET status = 'published', publishedAt = datetime('now')
        WHERE id = ?
    `;
    global.db.run(query, [req.params.id], function(err) {
        if (err) return next(err);
        res.redirect("/organiser-home");
    });
});

// Update an event after editing
app.post('/events/:id/update', (req, res, next) => {
    const query = `
        UPDATE events
        SET title = ?, date = ?, tickets = ?
        WHERE id = ?
    `;
    const params = [
        req.body.title,
        req.body.date,
        req.body.tickets,   // store as JSON string if needed
        req.params.id
    ];

    global.db.run(query, params, function(err) {
        if (err) return next(err);

        // Redirect back to organiser home page after saving
        res.redirect('/organiser-home');
    });
});

// Delete an event
app.post('/events/:id/delete', (req, res, next) => {
    const query = "DELETE FROM events WHERE id = ?";
    global.db.run(query, [req.params.id], function(err) {
        if (err) return next(err);
        res.redirect("/organiser-home");
    });
});


// Display the Site Settings page
app.get('/site-settings', (req, res, next) => {
    const query = "SELECT * FROM site_settings LIMIT 1";
    global.db.get(query, (err, settings) => {
        if (err) return next(err);
        if (!settings) {
            // Insert default settings if table is empty
            const insertDefault = "INSERT INTO site_settings (name, description) VALUES (?, ?)";
            global.db.run(insertDefault, ["Stretch Yoga", "Yoga classes for all ages and abilities"], function(err) {
                if (err) return next(err);
                res.redirect('/site-settings');
            });
        } else {
            res.render('site-settings.ejs', { settings });
        }
    });
});

// Handle form submission and update site settings
app.post('/site-settings', (req, res, next) => {
    const { name, description } = req.body;

    if (!name || !description) {
        return res.send("Please fill in all fields");
    }

    const query = "UPDATE site_settings SET name = ?, description = ? WHERE id = 1";
    global.db.run(query, [name, description], function(err) {
        if (err) return next(err);
        res.redirect('/organiser-home');
    });
});

// Edit event page
app.get('/events/:id/edit', (req, res) => {
    const eventId = req.params.id;

    global.db.get(
        "SELECT * FROM events WHERE id = ?",
        [eventId],
        (err, event) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Database error");
            }
            if (!event) {
                return res.status(404).send("Event not found");
            }

            // Parse tickets JSON
            event.tickets = event.tickets ? JSON.parse(event.tickets) : {
                full: { quantity: 0, price: 0 },
                concession: { quantity: 0, price: 0 }
            };

            res.render('edit-event', { event });
        }
    );
});

// Update event
app.post('/events/:id/update', (req, res) => {
    const eventId = req.params.id;

    const {
        title,
        description,
        fullQuantity,
        fullPrice,
        concessionQuantity,
        concessionPrice
    } = req.body;

    // Basic validation
    if (!title || !description) {
        return res.status(400).send("All fields required");
    }

    const tickets = JSON.stringify({
        full: {
            quantity: Number(fullQuantity),
            price: Number(fullPrice)
        },
        concession: {
            quantity: Number(concessionQuantity),
            price: Number(concessionPrice)
        }
    });

    const lastModifiedAt = new Date().toISOString();

    global.db.run(
        `
        UPDATE events
        SET title = ?,
            description = ?,
            tickets = ?,
            lastModifiedAt = ?
        WHERE id = ?
        `,
        [title, description, tickets, lastModifiedAt, eventId],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).send("Update failed");
            }
            res.redirect('/organiser');
        }
    );
});

// Attendee Home Page
app.get('/attendee', (req, res, next) => {

    // Get site name & description
    const settingsQuery = "SELECT * FROM site_settings LIMIT 1";

    global.db.get(settingsQuery, (err, site) => {
        if (err) return next(err);

        // Get published events ordered by date (soonest first)
        const eventsQuery = `
            SELECT id, title, date
            FROM events
            WHERE status = 'published'
            ORDER BY date ASC
        `;

        global.db.all(eventsQuery, (err, events) => {
            if (err) return next(err);

            res.render('attendee-home.ejs', {
                site,
                events
            });
        });
    });
});

// Make the 

// Make the web application listen for HTTP requests
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

