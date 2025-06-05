// intelliface_api/controllers/todo.controller.js
const Todo = require('../models/Todo.model');
const User = require('../models/User'); // Assumes User.js is your model filename

// @desc    Create a new to-do item
// @route   POST /api/todos
// @access  Private (requires verifyToken)
exports.createTodo = async (req, res, next) => {
  console.log("BACKEND createTodo: Controller hit."); // Log entry
  console.log("BACKEND createTodo: req.user from token:", JSON.stringify(req.user, null, 2)); // Log req.user
  console.log("BACKEND createTodo: req.body received:", JSON.stringify(req.body, null, 2)); // Log req.body
  try {
    const { title, description, dueDate } = req.body;
    const userIdFromToken = req.user.userId; // Based on your JWT payload structure

    if (!userIdFromToken) {
        console.error("BACKEND createTodo ERROR: userId missing from token payload (req.user).");
        return res.status(401).json({ success: false, message: 'User not authenticated or user ID missing.' });
    }
    if (!title) {
      console.log("BACKEND createTodo ERROR: Title is missing.");
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const todoData = {
      user: userIdFromToken,
      title: title.trim(),
    };

    if (description !== undefined && description !== null) { // Ensure description isn't accidentally set if undefined
        todoData.description = description.trim();
    }
    if (dueDate) {
        const parsedDate = new Date(dueDate);
        if (isNaN(parsedDate.getTime())) {
            console.log("BACKEND createTodo ERROR: Invalid dueDate format received:", dueDate);
            return res.status(400).json({ success: false, message: 'Invalid dueDate format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD).' });
        }
        todoData.dueDate = parsedDate;
    }
    
    console.log("BACKEND createTodo: Attempting to create todo with data:", JSON.stringify(todoData, null, 2));
    const todo = await Todo.create(todoData); // Todo.create is fine and widely used
    console.log("BACKEND createTodo: Todo CREATED successfully in DB:", JSON.stringify(todo, null, 2));

    res.status(201).json({ success: true, data: todo });
  } catch (error) {
    console.error("BACKEND createTodo: <<<< ERROR DURING CREATION >>>>");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    // console.error("Error Stack:", error.stack); // Uncomment for very detailed stack, can be long
    if (error.errors) { 
        console.error("Validation Errors:", JSON.stringify(error.errors, null, 2));
    }

    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: "Server error while creating to-do. Please try again."});
  }
};

// @desc    Get all to-do items for the logged-in user
// @route   GET /api/todos
// @access  Private (requires verifyToken)
exports.getUserTodos = async (req, res, next) => {
  console.log("BACKEND getUserTodos: Controller hit. req.user:", JSON.stringify(req.user, null, 2), "req.query:", JSON.stringify(req.query, null, 2));
  try {
    const userIdFromToken = req.user.userId;
     if (!userIdFromToken) {
        return res.status(401).json({ success: false, message: 'User not authenticated or user ID missing.' });
    }

    const query = { user: userIdFromToken };

    if (req.query.date) {
      const selectedDate = new Date(req.query.date);
      if (isNaN(selectedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date format for query. Use YYYY-MM-DD.' });
      }
      // Using UTC to define the start and end of the day to avoid timezone issues with $gte/$lt
      const startDate = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), selectedDate.getUTCDate()));
      const endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 1);
      
      query.dueDate = { $gte: startDate, $lt: endDate };
    }

    if (req.query.completed !== undefined) { // Check if the parameter is actually present
      if (req.query.completed === 'true' || req.query.completed === 'false') {
        query.isCompleted = req.query.completed === 'true';
      } else {
        return res.status(400).json({ success: false, message: "Invalid 'completed' query parameter. Use 'true' or 'false'." });
      }
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    const todos = await Todo.find(query)
      .sort({ isCompleted: 'asc', createdAt: 'desc' }) // Incomplete first, then by newest
      .skip(startIndex)
      .limit(limit);
      // .populate('user', 'fullName username'); // Optional

    const total = await Todo.countDocuments(query);
    console.log(`BACKEND getUserTodos: Found ${todos.length} of ${total} total todos for user ${userIdFromToken}.`);

    res.status(200).json({
      success: true,
      count: todos.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      data: todos,
    });
  } catch (error) {
    console.error("BACKEND getUserTodos: Error:", error);
    res.status(500).json({ success: false, message: "Server error while fetching to-dos."});
  }
};

// @desc    Get a single to-do item by ID
// @route   GET /api/todos/:id
// @access  Private
exports.getTodoById = async (req, res, next) => {
  console.log("BACKEND getTodoById: Controller hit for ID:", req.params.id, "req.user:", JSON.stringify(req.user, null, 2));
  try {
    const todo = await Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ success: false, message: 'To-Do item not found.' });
    }

    if (todo.user.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this to-do.' });
    }

    res.status(200).json({ success: true, data: todo });
  } catch (error) {
    console.error("BACKEND getTodoById: Error:", error);
    if (error.name === 'CastError') { // Often due to invalid ObjectId format
        return res.status(400).json({ success: false, message: 'Invalid To-Do ID format.' });
    }
    res.status(500).json({ success: false, message: "Server error while fetching to-do."});
  }
};

// @desc    Update a to-do item
// @route   PUT /api/todos/:id
// @access  Private
exports.updateTodo = async (req, res, next) => {
  console.log("BACKEND updateTodo: Controller hit for ID:", req.params.id, "req.user:", JSON.stringify(req.user, null, 2), "req.body:", JSON.stringify(req.body, null, 2));
  try {
    let todo = await Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ success: false, message: 'To-Do item not found.' });
    }

    if (todo.user.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this to-do.' });
    }

    const { title, description, dueDate, isCompleted } = req.body;

    // Update fields only if they are provided in the request body
    if (title !== undefined) todo.title = title.trim();
    if (description !== undefined) todo.description = description.trim(); // Allow empty string to clear
    if (dueDate !== undefined) {
        if (dueDate === null || dueDate === "") {
            todo.dueDate = null;
        } else {
            const parsedDate = new Date(dueDate);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid dueDate format for update. Use ISO 8601 format or null/empty to clear.' });
            }
            todo.dueDate = parsedDate;
        }
    }
    if (isCompleted !== undefined) todo.isCompleted = Boolean(isCompleted); // Ensure it's a boolean

    const updatedTodo = await todo.save(); // .save() triggers Mongoose middleware and validation
    console.log("BACKEND updateTodo: Todo UPDATED successfully:", JSON.stringify(updatedTodo, null, 2));

    res.status(200).json({ success: true, data: updatedTodo });
  } catch (error) {
    console.error("BACKEND updateTodo: <<<< ERROR DURING UPDATE >>>>");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    if (error.errors) { 
        console.error("Validation Errors:", JSON.stringify(error.errors, null, 2));
    }
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid To-Do ID format for update.' });
    }
    res.status(500).json({ success: false, message: "Server error while updating to-do."});
  }
};

// @desc    Delete a to-do item
// @route   DELETE /api/todos/:id
// @access  Private
exports.deleteTodo = async (req, res, next) => {
  console.log("BACKEND deleteTodo: Controller hit for ID:", req.params.id, "req.user:", JSON.stringify(req.user, null, 2));
  try {
    const todo = await Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ success: false, message: 'To-Do item not found.' });
    }

    if (todo.user.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this to-do.' });
    }

    await todo.deleteOne(); // Mongoose v6+ .remove() is deprecated
    console.log("BACKEND deleteTodo: Todo DELETED successfully. ID:", req.params.id);

    res.status(200).json({ success: true, message: 'To-Do item removed successfully.' });
  } catch (error) {
    console.error("BACKEND deleteTodo: Error:", error);
    if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid To-Do ID format.' });
    }
    res.status(500).json({ success: false, message: "Server error while deleting to-do."});
  }
};