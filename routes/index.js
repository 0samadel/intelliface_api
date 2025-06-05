// api/routes/index.js
const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const attendanceRoutes = require('./attendance.routes');
const todoRoutes = require('./todo.routes');

const router = express.Router();

const defaultRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/users', route: userRoutes },
  { path: '/admin', route: adminRoutes },
  { path: '/attendance', route: attendanceRoutes },
  { path: '/todos', route: todoRoutes },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;