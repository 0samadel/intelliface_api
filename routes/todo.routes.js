// intelliface_api/routes/todo.routes.js
const express = require('express');
const {
  createTodo,
  getUserTodos,
  getTodoById,
  updateTodo,
  deleteTodo,
} = require('../controllers/todo.controller');
const { verifyToken } = require('../middleware/authMiddleware'); // Path should be correct

const router = express.Router();

router.use(verifyToken); // Protect all routes in this file

router.route('/')
  .post(createTodo)
  .get(getUserTodos);

router.route('/:id')
  .get(getTodoById)
  .put(updateTodo)
  .delete(deleteTodo);

module.exports = router;