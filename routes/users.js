/**
 * events.js
 * Routes for managing events for the Organiser Home Page
 * Demonstrates creating, editing, publishing, deleting, and listing events
 */

 const express = require("express");
 const router = express.Router();
 
 /**
  * @desc Get all events (drafts and published) for the organiser
  */
 router.get("/organiser-home", (req, res, next) => {
     const publishedQuery = "SELECT * FROM events WHERE status = 'published'";
     const draftQuery = "SELECT * FROM events WHERE status = 'draft'";
 
     global.db.all(publishedQuery, function(err, publishedEvents) {
         if (err) return next(err);
 
         global.db.all(draftQuery, function(err, draftEvents) {
             if (err) return next(err);
 
             // Example event manager info, you can replace this with actual DB call
             const eventManager = {
                 name: "Stretch Yoga",
                 description: "Yoga classes for all ages and abilities"
             };
 
             res.render("organiser-home.ejs", { publishedEvents, draftEvents, eventManager });
         });
     });
 });
 
 /**
  * @desc Create a new draft event and redirect to its edit page
  */
 router.post("/events/create", (req, res, next) => {
     const query = `
         INSERT INTO events (title, date, status, createdAt)
         VALUES (?, ?, 'draft', datetime('now'))
     `;
     const query_parameters = ["New Event", "2025-12-31"]; // Default values
 
     global.db.run(query, query_parameters, function(err) {
         if (err) return next(err);
 
         // Redirect to edit page for the new event
         res.redirect(`/events/${this.lastID}/edit`);
     });
 });
 
 /**
  * @desc Render edit page for a specific event
  */
 router.get("/events/:id/edit", (req, res, next) => {
     const query = "SELECT * FROM events WHERE id = ?";
     const params = [req.params.id];
 
     global.db.get(query, params, function(err, event) {
         if (err) return next(err);
 
         if (!event) return res.status(404).send("Event not found");
 
         res.render("edit-event.ejs", { event });
     });
 });
 
 /**
  * @desc Publish a draft event
  */
 router.post("/events/:id/publish", (req, res, next) => {
     const query = `
         UPDATE events
         SET status = 'published', publishedAt = datetime('now')
         WHERE id = ?
     `;
     const params = [req.params.id];
 
     global.db.run(query, params, function(err) {
         if (err) return next(err);
 
         res.redirect("/organiser-home");
     });
 });
 
 /**
  * @desc Delete an event
  */
 router.post("/events/:id/delete", (req, res, next) => {
     const query = "DELETE FROM events WHERE id = ?";
     const params = [req.params.id];
 
     global.db.run(query, params, function(err) {
         if (err) return next(err);
 
         res.redirect("/organiser-home");
     });
 });
 
 module.exports = router;
 