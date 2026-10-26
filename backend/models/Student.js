const mongoose = require('mongoose')
const auth = require('../middleware/auth')

const studentSchema = new mongoose.Schema(
{
name: {
type: String,
required: true,
trim: true,
},

email: {
  type: String,
  required: true,
  unique: true,
  lowercase: true,
  trim: true,
},

department: {
  type: String,
  required: true,
  trim: true,
},

semester: {
  type: Number,
  required: true,
  min: 1,
  max: 8,
},

},
{
timestamps: true,
}
)

module.exports = mongoose.model('Student', studentSchema)
